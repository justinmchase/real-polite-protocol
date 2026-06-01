import { encodeHex } from "@std/encoding/hex";

/**
 * Outbound envelope delivery helpers used by MCP tools. Mirrors the inbound
 * verification logic in `controllers/submit/envelope-hmac.ts`.
 */

const TEXT_ENCODER = new TextEncoder();

function envelopeUrl(domain: string): string {
  const isLocalhost = domain === "localhost" || domain.startsWith("localhost:");
  const scheme = isLocalhost ? "http" : "https";
  return `${scheme}://${domain}/rpp/v1/envelopes`;
}

async function signEnvelope(
  secret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prefix = TEXT_ENCODER.encode(`${timestamp}.`);
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  return encodeHex(new Uint8Array(sig));
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  /** Receiver error code parsed from response body, if any. */
  receiverCode?: string;
}

async function readReceiverCode(
  response: Response,
): Promise<string | undefined> {
  try {
    const body = await response.json() as Record<string, unknown>;
    return typeof body.code === "string" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send an `invitation` envelope (or cancellation). Auth: receptive policy id
 * carried in `x-rpp-receptive-policy-id`. The envelope's
 * `receptive_policy_id` (when set) must match the header value (spec §6.1).
 */
export async function dispatchInvitationEnvelope(
  receiverDomain: string,
  envelope: Record<string, unknown>,
  options: { receptivePolicyId?: string; shortcode?: string },
): Promise<DispatchResult> {
  if (!options.receptivePolicyId && !options.shortcode) {
    throw new Error(
      "dispatchInvitationEnvelope requires receptivePolicyId or shortcode",
    );
  }
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.receptivePolicyId) {
    headers["x-rpp-receptive-policy-id"] = options.receptivePolicyId;
  }
  if (options.shortcode) {
    // Spec §6.1 / req:receptive-policy-007: when an invitation is being sent
    // via a shortcode rather than a full policy id, the shortcode MUST be
    // carried in the `x-rpp-shortcode` header so the receiver can resolve
    // the policy.
    headers["x-rpp-shortcode"] = options.shortcode;
  }
  const response = await fetch(envelopeUrl(receiverDomain), {
    method: "POST",
    headers,
    body: JSON.stringify(envelope),
  });
  const receiverCode = response.ok
    ? undefined
    : await readReceiverCode(response);
  // Only cancel if the body hasn't been consumed yet (response.ok path).
  if (response.ok) await response.body?.cancel();
  return { ok: response.ok, status: response.status, receiverCode };
}

/**
 * Send an `invitation_reply` envelope. Auth: HMAC over canonical input using
 * the contact secret the original sender supplied in `reply_credential`. The
 * `x-rpp-contact-id` header carries the contact id from that credential.
 */
export async function dispatchInvitationReplyEnvelope(
  receiverDomain: string,
  envelope: Record<string, unknown>,
  credential: { contact_id: string; contact_secret: string },
): Promise<DispatchResult> {
  const bodyBytes = TEXT_ENCODER.encode(JSON.stringify(envelope));
  const timestamp = new Date().toISOString();
  const signature = await signEnvelope(
    credential.contact_secret,
    timestamp,
    bodyBytes,
  );
  const response = await fetch(envelopeUrl(receiverDomain), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rpp-contact-id": credential.contact_id,
      "x-rpp-timestamp": timestamp,
      "x-rpp-signature": signature,
    },
    body: bodyBytes,
  });
  const receiverCode = response.ok
    ? undefined
    : await readReceiverCode(response);
  if (response.ok) await response.body?.cancel();
  return { ok: response.ok, status: response.status, receiverCode };
}

/**
 * Send a `message` envelope to a contact. Auth: HMAC over canonical input
 * using the contact's `remote_credential.contact_secret`.
 */
export async function dispatchMessageEnvelope(
  receiverDomain: string,
  envelope: Record<string, unknown>,
  credential: { contact_id: string; contact_secret: string },
): Promise<DispatchResult> {
  return await dispatchInvitationReplyEnvelope(
    receiverDomain,
    envelope,
    credential,
  );
}
