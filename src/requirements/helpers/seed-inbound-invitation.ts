import { generate as generateUUIDv7 } from "@std/uuid/v7";
import {
  type CommunicationTermsSeed,
  type ContactCredentialSeed,
  makeCredential,
} from "./seed-contact.ts";

export interface SeedInboundInvitationOptions {
  ownerOid: string;
  invitationId?: string;
  remoteDomain?: string;
  remoteDomainId?: string;
  communicationTerms?: CommunicationTermsSeed;
  /** Credential the remote supplied for the local domain to reply with. */
  replyCredential?: ContactCredentialSeed;
  status?: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  senderDisplayName?: string;
  message?: string;
  expiresAt?: Date;
  sentAt?: Date;
  claims?: Record<string, unknown>;
}

export interface SeededInboundInvitation {
  invitation_id: string;
  remote_domain: string;
  remote_domain_id: string;
  reply_credential: ContactCredentialSeed;
  communication_terms: CommunicationTermsSeed;
}

const DEFAULT_TERMS: CommunicationTermsSeed = {
  categories: ["correspondence"],
  max_content_rating: "PG",
};

/**
 * Seed an inbound invitation record directly into KV using the same layout as
 * `InvitationRepository`.
 */
export async function seedInboundInvitation(
  kv: Deno.Kv,
  opts: SeedInboundInvitationOptions,
): Promise<SeededInboundInvitation> {
  const invitationId = opts.invitationId ?? generateUUIDv7();
  const remoteDomain = opts.remoteDomain ?? "sender.example";
  const remoteDomainId = opts.remoteDomainId ?? generateUUIDv7();
  const replyCredential = opts.replyCredential ?? makeCredential();
  const communicationTerms = opts.communicationTerms ?? DEFAULT_TERMS;
  const sentAt = opts.sentAt ?? new Date();
  const claims = opts.claims ?? {
    immutable: { domain_id: remoteDomainId },
  };

  const invitation = {
    invitation_id: invitationId,
    direction: "inbound",
    owner_oid: opts.ownerOid,
    remote_domain: remoteDomain,
    status: opts.status ?? "pending",
    communication_terms: communicationTerms,
    reply_credential: replyCredential,
    claims,
    ...(opts.senderDisplayName !== undefined &&
      { sender_display_name: opts.senderDisplayName }),
    ...(opts.message !== undefined && { message: opts.message }),
    ...(opts.expiresAt !== undefined && { expires_at: opts.expiresAt }),
    sent_at: sentAt,
    created_at: sentAt,
  };

  await kv.atomic()
    .set(["invitations", invitationId], invitation)
    .set(
      ["invitations_by_owner", opts.ownerOid, "inbound", invitationId],
      invitationId,
    )
    .commit();

  return {
    invitation_id: invitationId,
    remote_domain: remoteDomain,
    remote_domain_id: remoteDomainId,
    reply_credential: replyCredential,
    communication_terms: communicationTerms,
  };
}
