import { encodeHex } from "@std/encoding/hex";
import type { Receipt } from "../../models/mod.ts";

export interface CallbackEnvelope {
  category: "receipt";
  invitation_id: string;
  decision: "accepted" | "rejected";
  receipt?: {
    id: string;
    secret: string;
    category: string;
    max_content_rating?: string;
    usage_policy?: string;
    issued_at: Date;
  };
  reason?: string;
}

async function signHmac(
  secret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  return encodeHex(new Uint8Array(sig));
}

export interface CallbackDeliveryResult {
  ok: boolean;
  /** True when the remote returned a permanent (4xx) failure. */
  permanentFailure: boolean;
  status: number;
}

/**
 * Build and POST a receipt callback envelope to the inviting domain's
 * envelope endpoint. Signs the request body with HMAC-SHA256 using the
 * delivery token.
 *
 * Returns the outcome so callers can decide whether to mark the invitation
 * `undelivered` (on permanent failure).
 */
export async function deliverReceiptCallback(
  delivery: { domain: string; token: string },
  invitationId: string,
  decision: "accepted" | "rejected",
  receipt: Receipt | undefined,
  reason: string | undefined,
): Promise<CallbackDeliveryResult> {
  const envelope: CallbackEnvelope = {
    category: "receipt",
    invitation_id: invitationId,
    decision,
    ...(receipt !== undefined && {
      receipt: {
        id: receipt.id,
        secret: receipt.secret,
        category: receipt.category,
        ...(receipt.max_content_rating !== undefined &&
          { max_content_rating: receipt.max_content_rating }),
        ...(receipt.usage_policy !== undefined &&
          { usage_policy: receipt.usage_policy }),
        issued_at: receipt.issued_at,
      },
    }),
    ...(reason !== undefined && { reason }),
  };

  const bodyBytes = new TextEncoder().encode(JSON.stringify(envelope));
  const timestamp = new Date().toISOString();
  const signature = await signHmac(delivery.token, timestamp, bodyBytes);

  const isLocalhost = delivery.domain === "localhost" ||
    delivery.domain.startsWith("localhost:");
  const scheme = isLocalhost ? "http" : "https";
  const url = `${scheme}://${delivery.domain}/rpp/v1/envelopes`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rpp-invitation-id": invitationId,
      "x-rpp-timestamp": timestamp,
      "x-rpp-signature": signature,
    },
    body: bodyBytes,
  });
  await response.body?.cancel();

  return {
    ok: response.ok,
    permanentFailure: response.status >= 400 && response.status < 500,
    status: response.status,
  };
}
