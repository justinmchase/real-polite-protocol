import type { ContactCredentialSeed } from "./seed-contact.ts";
import type { CommunicationTermsSeed } from "./seed-contact.ts";

export interface SubmitInvitationOptions {
  receptivePolicyId?: string;
  shortcode?: string;
  invitationId?: string;
  senderDomain?: string;
  senderDomainId?: string;
  /** Communication terms the sender is willing to receive. */
  communicationTerms?: CommunicationTermsSeed;
  /** Credential the sender embeds for the receiver to use when replying. */
  replyCredential?: ContactCredentialSeed;
  claims?: Record<string, unknown>;
  message?: string;
  cancelled?: boolean;
  sentAt?: Date;
  expiresAt?: Date;
  baseUrl?: string;
  /** Override whole envelope body for malformed-input tests. */
  rawBody?: string | Uint8Array;
  /** Omit identity header when true (used for §8.3 path 2 tests). */
  omitPolicyHeader?: boolean;
}

const DEFAULT_TERMS: CommunicationTermsSeed = {
  categories: ["correspondence"],
  max_content_rating: "PG",
};

/**
 * POST an `invitation` envelope to the local server. Auth is the receptive
 * policy id sent via `x-rpp-receptive-policy-id` (spec §6.1 + §10.1).
 */
export async function submitInvitationEnvelope(
  opts: SubmitInvitationOptions,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (!opts.omitPolicyHeader && opts.receptivePolicyId) {
    headers["x-rpp-receptive-policy-id"] = opts.receptivePolicyId;
  }

  let body: string | Uint8Array;
  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
  } else {
    const senderDomain = opts.senderDomain ?? "sender.example";
    const senderDomainId = opts.senderDomainId ?? crypto.randomUUID();
    const replyCredential = opts.replyCredential ?? {
      contact_id: crypto.randomUUID(),
      contact_secret: "a".repeat(32),
    };
    const envelope: Record<string, unknown> = {
      category: "invitation",
      invitation_id: opts.invitationId ?? crypto.randomUUID(),
      sender_domain: senderDomain,
      sent_at: (opts.sentAt ?? new Date()).toISOString(),
      communication_terms: opts.communicationTerms ?? DEFAULT_TERMS,
      reply_credential: replyCredential,
      claims: opts.claims ?? { immutable: { domain_id: senderDomainId } },
      ...(opts.receptivePolicyId !== undefined &&
        { receptive_policy_id: opts.receptivePolicyId }),
      ...(opts.shortcode !== undefined && { shortcode: opts.shortcode }),
      ...(opts.message !== undefined && { message: opts.message }),
      ...(opts.expiresAt !== undefined &&
        { expires_at: opts.expiresAt.toISOString() }),
      ...(opts.cancelled !== undefined && { cancelled: opts.cancelled }),
    };
    body = JSON.stringify(envelope);
  }

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/envelopes`,
    { method: "POST", headers, body },
  );
}
