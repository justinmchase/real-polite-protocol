import { generate as generateUUIDv7 } from "@std/uuid/v7";
import {
  type CommunicationTermsSeed,
  type ContactCredentialSeed,
  makeCredential,
} from "./seed-contact.ts";

export interface SeedOutboundInvitationOptions {
  ownerOid: string;
  invitationId?: string;
  remoteDomain?: string;
  communicationTerms?: CommunicationTermsSeed;
  /**
   * Credential the local domain generated for the remote to use when replying.
   * Becomes the contact's `local_credential` upon successful invitation_reply.
   */
  replyCredential?: ContactCredentialSeed;
  /** local domain_id (used for outbound claims.immutable.domain_id). */
  localDomainId?: string;
  status?: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  message?: string;
  expiresAt?: Date;
  sentAt?: Date;
}

export interface SeededOutboundInvitation {
  invitation_id: string;
  remote_domain: string;
  reply_credential: ContactCredentialSeed;
  communication_terms: CommunicationTermsSeed;
  local_domain_id: string;
}

const DEFAULT_TERMS: CommunicationTermsSeed = {
  categories: ["correspondence"],
  max_content_rating: "PG",
};

/**
 * Seed an outbound invitation record directly into KV. Use this when a test
 * needs to exercise inbound `invitation_reply` handling against a
 * locally-pending outbound invitation.
 */
export async function seedOutboundInvitation(
  kv: Deno.Kv,
  opts: SeedOutboundInvitationOptions,
): Promise<SeededOutboundInvitation> {
  const invitationId = opts.invitationId ?? generateUUIDv7();
  const remoteDomain = opts.remoteDomain ?? "remote.example";
  const replyCredential = opts.replyCredential ?? makeCredential();
  const communicationTerms = opts.communicationTerms ?? DEFAULT_TERMS;
  const sentAt = opts.sentAt ?? new Date();
  const localDomainId = opts.localDomainId ?? generateUUIDv7();

  const invitation = {
    invitation_id: invitationId,
    direction: "outbound",
    owner_oid: opts.ownerOid,
    remote_domain: remoteDomain,
    status: opts.status ?? "pending",
    communication_terms: communicationTerms,
    reply_credential: replyCredential,
    claims: { immutable: { domain_id: localDomainId } },
    ...(opts.message !== undefined && { message: opts.message }),
    ...(opts.expiresAt !== undefined && { expires_at: opts.expiresAt }),
    sent_at: sentAt,
    created_at: sentAt,
  };

  await kv.atomic()
    .set(["invitations", opts.ownerOid, invitationId], invitation)
    .set(
      ["invitations_by_owner", opts.ownerOid, "outbound", invitationId],
      invitationId,
    )
    .set(
      ["invitations_by_id", invitationId, "outbound"],
      opts.ownerOid,
    )
    .commit();

  return {
    invitation_id: invitationId,
    remote_domain: remoteDomain,
    reply_credential: replyCredential,
    communication_terms: communicationTerms,
    local_domain_id: localDomainId,
  };
}
