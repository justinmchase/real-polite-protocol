import { computeHmac } from "./compute-hmac.ts";
import {
  type CommunicationTermsSeed,
  type ContactCredentialSeed,
  makeCredential,
} from "./seed-contact.ts";

export interface SubmitInvitationReplyOptions {
  /** Invitation id of the outbound invitation being replied to. */
  invitationId: string;
  /** Credential to sign with — the outbound invitation's reply_credential. */
  signingCredential: ContactCredentialSeed;
  /** Credential the remote includes in the reply envelope. */
  replyCredential?: ContactCredentialSeed;
  senderDomain?: string;
  senderDomainId?: string;
  communicationTerms?: CommunicationTermsSeed;
  message?: string;
  claims?: Record<string, unknown>;
  sentAt?: Date;
  timestamp?: string;
  baseUrl?: string;
}

const DEFAULT_TERMS: CommunicationTermsSeed = {
  categories: ["correspondence"],
  max_content_rating: "PG",
};

/**
 * POST an `invitation_reply` envelope to the local server, HMAC-signed with
 * the signing credential. Used when simulating a remote sender's reply to a
 * locally-pending outbound invitation.
 */
export async function submitInvitationReplyEnvelope(
  opts: SubmitInvitationReplyOptions,
): Promise<Response> {
  const senderDomain = opts.senderDomain ?? "remote.example";
  const senderDomainId = opts.senderDomainId ?? crypto.randomUUID();
  const replyCredential = opts.replyCredential ?? makeCredential();
  const envelope = {
    category: "invitation_reply" as const,
    invitation_id: opts.invitationId,
    sender_domain: senderDomain,
    sent_at: (opts.sentAt ?? new Date()).toISOString(),
    communication_terms: opts.communicationTerms ?? DEFAULT_TERMS,
    reply_credential: replyCredential,
    claims: opts.claims ?? { immutable: { domain_id: senderDomainId } },
    ...(opts.message !== undefined && { message: opts.message }),
  };

  const bodyJson = JSON.stringify(envelope);
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(
    opts.signingCredential.contact_secret,
    timestamp,
    bodyBytes,
  );

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/envelopes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpp-contact-id": opts.signingCredential.contact_id,
        "x-rpp-signature": signature,
        "x-rpp-timestamp": timestamp,
      },
      body: bodyJson,
    },
  );
}
