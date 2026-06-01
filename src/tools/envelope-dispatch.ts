import { encodeHex } from "@std/encoding/hex";
import {
  InvitationEnvelopeHandler,
  InvitationReplyEnvelopeHandler,
  MessageEnvelopeHandler,
  MessageEnvelopeSchema,
} from "../controllers/submit/message-handler.ts";
import type {
  ContactManager,
  InvitationManager,
  MessageManager,
  ReceptivePolicyManager,
} from "../managers/mod.ts";
import {
  InvitationEnvelopeSchema,
  InvitationReplyEnvelopeSchema,
} from "../models/invitation/invitation.model.ts";
import type { ConfigService } from "../services/config/config.service.ts";

/**
 * Outbound envelope delivery used by MCP tools.
 *
 * Per req:submit-005 (application-specific, not spec-driven), when the target
 * domain equals `ConfigService.domain` the dispatcher MUST short-circuit to
 * the in-process envelope handler instead of issuing an HTTP request to its
 * own hostname — Deno Deploy rejects self-loop requests with HTTP 508 Loop
 * Detected. The same-domain path does not sign or set any auth headers.
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

export class EnvelopeDispatcher {
  private readonly invitationHandler: InvitationEnvelopeHandler;
  private readonly invitationReplyHandler: InvitationReplyEnvelopeHandler;
  private readonly messageHandler: MessageEnvelopeHandler;

  constructor(
    private readonly config: ConfigService,
    invitationManager: InvitationManager,
    receptivePolicyManager: ReceptivePolicyManager,
    contactManager: ContactManager,
    messageManager: MessageManager,
  ) {
    this.invitationHandler = new InvitationEnvelopeHandler(
      invitationManager,
      receptivePolicyManager,
    );
    this.invitationReplyHandler = new InvitationReplyEnvelopeHandler(
      invitationManager,
      contactManager,
    );
    this.messageHandler = new MessageEnvelopeHandler(
      messageManager,
      contactManager,
    );
  }

  private isSameDomain(receiverDomain: string): boolean {
    return receiverDomain.toLowerCase() === this.config.domain.toLowerCase();
  }

  /**
   * Send an `invitation` envelope (or cancellation). Auth: receptive policy id
   * carried in `x-rpp-receptive-policy-id` (or `x-rpp-shortcode`). On the
   * same-domain short-circuit path the headers are not used; the in-process
   * handler resolves the policy directly from the envelope.
   */
  async dispatchInvitation(
    receiverDomain: string,
    envelope: Record<string, unknown>,
    options: { receptivePolicyId?: string; shortcode?: string },
  ): Promise<DispatchResult> {
    if (!options.receptivePolicyId && !options.shortcode) {
      throw new Error(
        "dispatchInvitation requires receptivePolicyId or shortcode",
      );
    }
    if (this.isSameDomain(receiverDomain)) {
      const parsed = InvitationEnvelopeSchema.parse(envelope);
      await this.invitationHandler.handle(parsed, new Date());
      return { ok: true, status: 202 };
    }
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (options.receptivePolicyId) {
      headers["x-rpp-receptive-policy-id"] = options.receptivePolicyId;
    }
    if (options.shortcode) {
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
    if (response.ok) await response.body?.cancel();
    return { ok: response.ok, status: response.status, receiverCode };
  }

  /**
   * Send an `invitation_reply` envelope. Auth: HMAC over canonical input using
   * the contact secret the original sender supplied in `reply_credential`.
   * On the same-domain short-circuit path the HMAC is skipped.
   */
  async dispatchInvitationReply(
    receiverDomain: string,
    envelope: Record<string, unknown>,
    credential: { contact_id: string; contact_secret: string },
  ): Promise<DispatchResult> {
    if (this.isSameDomain(receiverDomain)) {
      const parsed = InvitationReplyEnvelopeSchema.parse(envelope);
      await this.invitationReplyHandler.handle(parsed, new Date());
      return { ok: true, status: 202 };
    }
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
   * using the contact's `remote_credential.contact_secret`. On the
   * same-domain short-circuit path the HMAC is skipped and the handler is
   * invoked directly using `credential.contact_id` (which on the receiver
   * side is the recipient contact's `local_credential.contact_id`).
   */
  async dispatchMessage(
    receiverDomain: string,
    envelope: Record<string, unknown>,
    credential: { contact_id: string; contact_secret: string },
  ): Promise<DispatchResult> {
    if (this.isSameDomain(receiverDomain)) {
      const parsed = MessageEnvelopeSchema.parse(envelope);
      await this.messageHandler.handle(
        parsed,
        credential.contact_id,
        new Date(),
      );
      return { ok: true, status: 202 };
    }
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
}
