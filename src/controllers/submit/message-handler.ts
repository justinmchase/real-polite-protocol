import { z } from "zod";
import {
  ContactBlockedError,
  ContactSenderDomainMismatchError,
} from "../../managers/contacts/contact.error.ts";
import {
  InvitationDirectionMismatchError,
  InvitationNotPendingError,
} from "../../managers/invitation/invitation.error.ts";
import type {
  ContactManager,
  InvitationManager,
  MessageManager,
  ReceptivePolicyManager,
} from "../../managers/mod.ts";
import { CONTENT_RATINGS } from "../../models/content-rating.ts";
import {
  InvitationEnvelopeSchema,
  InvitationReplyEnvelopeSchema,
} from "../../models/invitation/invitation.model.ts";
import { MESSAGE_CATEGORIES } from "../../models/message-category.ts";
import { MessageMetadataSchema } from "../../models/messages/stored-message.model.ts";
import {
  CategoryNotPermittedError,
  ContentRatingNotPermittedError,
  InvalidInvitationEnvelopeError,
  InvalidMessageEnvelopeError,
  ReceptivePolicyClosedError,
  ReceptivePolicyExpiredError,
  ReceptivePolicyNotFoundError,
  SubmitContactNotFoundError,
} from "./submit.error.ts";

// ---------- Wire schemas ----------

/**
 * `message` envelope wire shape, per spec §8.1. `message_id` and
 * `sender_domain` are required by the controller for dedup and contact
 * verification before this schema is applied.
 */
export const MessageEnvelopeSchema = z.object({
  message_id: z.string(),
  sender_domain: z.string(),
  sender_display_name: z.string().max(256).optional(),
  category: z.enum(MESSAGE_CATEGORIES),
  content_rating: z.enum(CONTENT_RATINGS),
  sent_at: z.coerce.date(),
  subject: z.string(),
  body: z.object({
    content_type: z.string(),
    content: z.string(),
  }),
  metadata: MessageMetadataSchema.optional(),
});

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;

/** Discriminated union over the three envelope kinds defined in §8. */
export const SubmitEnvelopeSchema = z.discriminatedUnion("category", [
  InvitationEnvelopeSchema,
  InvitationReplyEnvelopeSchema,
  MessageEnvelopeSchema,
]);

export type SubmitEnvelope = z.infer<typeof SubmitEnvelopeSchema>;

// ---------- Handler interface ----------

export interface EnvelopeHandlerResult {
  envelopeId: string;
}

// ---------- Invitation handler ----------

export class InvitationEnvelopeHandler {
  constructor(
    private readonly invitationManager: InvitationManager,
    private readonly receptivePolicyManager: ReceptivePolicyManager,
  ) {}

  async handle(
    envelope: z.infer<typeof InvitationEnvelopeSchema>,
    now: Date,
  ): Promise<EnvelopeHandlerResult> {
    // Resolve the receptive policy that authorizes this inbound invitation.
    let policyId = envelope.receptive_policy_id;
    if (!policyId && envelope.shortcode) {
      const byShort = await this.receptivePolicyManager.getByShortcode(
        envelope.shortcode,
      );
      if (!byShort) {
        throw new ReceptivePolicyNotFoundError(envelope.shortcode);
      }
      policyId = byShort.policy_id;
    }
    if (!policyId) {
      throw new InvalidInvitationEnvelopeError(
        "exactly one of receptive_policy_id or shortcode is required",
      );
    }

    const policy = await this.receptivePolicyManager.getById(policyId);
    if (!policy) throw new ReceptivePolicyNotFoundError(policyId);
    if (policy.receptive_until && policy.receptive_until < now) {
      throw new ReceptivePolicyExpiredError(policy.policy_id);
    }
    if (policy.mode === "closed") {
      throw new ReceptivePolicyClosedError(policy.policy_id);
    }
    if (policy.mode === "contact") {
      const remoteDomainId = envelope.claims.immutable["domain_id"];
      const senderDomain = envelope.sender_domain;
      const allowed = typeof remoteDomainId === "string" &&
        policy.contacts?.some(
          (c) =>
            c.domain_id === remoteDomainId &&
            c.domain.toLowerCase() === senderDomain.toLowerCase(),
        );
      if (!allowed) throw new ReceptivePolicyClosedError(policy.policy_id);
    }

    // Cancellation: spec §10.3. Re-submitted invitation with the same id and
    // `cancelled: true` transitions a pending inbound invitation to cancelled.
    if (envelope.cancelled) {
      await this.invitationManager.cancel(envelope.invitation_id, now);
      return { envelopeId: envelope.invitation_id };
    }

    await this.invitationManager.createInbound({
      invitationId: envelope.invitation_id,
      ownerOid: policy.oid,
      remoteDomain: envelope.sender_domain,
      communicationTerms: envelope.communication_terms,
      replyCredential: envelope.reply_credential,
      claims: envelope.claims,
      ...(envelope.sender_display_name !== undefined && {
        senderDisplayName: envelope.sender_display_name,
      }),
      ...(envelope.message !== undefined && { message: envelope.message }),
      ...(envelope.expires_at !== undefined && {
        expiresAt: envelope.expires_at,
      }),
      sentAt: envelope.sent_at,
      recordedAt: now,
    });

    return { envelopeId: envelope.invitation_id };
  }
}

// ---------- Invitation-reply handler ----------

export interface InvitationReplyAuthContext {
  /** Credential resolved by the controller before HMAC verification. */
  contactId: string;
  contactSecret: string;
}

export class InvitationReplyEnvelopeHandler {
  constructor(
    private readonly invitationManager: InvitationManager,
    private readonly contactManager: ContactManager,
  ) {}

  /**
   * Resolve the HMAC key for an inbound `invitation_reply`. The remote signs
   * with the `reply_credential.contact_secret` we issued in the outbound
   * invitation; we look up the outbound invitation by id and return the
   * matching credential.
   */
  async resolveAuth(
    invitationId: string,
    contactId: string,
  ): Promise<InvitationReplyAuthContext> {
    const invitation = await this.invitationManager.requireDirection(
      invitationId,
      "outbound",
    );
    if (invitation.reply_credential.contact_id !== contactId) {
      // Spec §11.2 / submit-002: any x-rpp-contact-id that does not resolve
      // to a known credential MUST be rejected with E_CONTACT_NOT_FOUND,
      // regardless of envelope category.
      throw new SubmitContactNotFoundError(contactId);
    }
    return {
      contactId: invitation.reply_credential.contact_id,
      contactSecret: invitation.reply_credential.contact_secret,
    };
  }

  async handle(
    envelope: z.infer<typeof InvitationReplyEnvelopeSchema>,
    now: Date,
  ): Promise<EnvelopeHandlerResult> {
    // The outbound invitation was already required for HMAC resolution; fetch
    // again here to perform the actual transition + contact creation. If the
    // status has since changed we surface the standard not-pending error.
    const invitation = await this.invitationManager.requireDirection(
      envelope.invitation_id,
      "outbound",
    );

    if (invitation.status !== "pending") {
      throw new InvitationNotPendingError(
        invitation.invitation_id,
        invitation.status,
      );
    }

    if (
      invitation.remote_domain.toLowerCase() !==
        envelope.sender_domain.toLowerCase()
    ) {
      throw new ContactSenderDomainMismatchError(
        invitation.remote_domain,
        envelope.sender_domain,
      );
    }

    const remoteDomainId = envelope.claims.immutable["domain_id"];
    if (typeof remoteDomainId !== "string" || remoteDomainId.length === 0) {
      throw new InvalidInvitationEnvelopeError(
        "claims.immutable.domain_id is required",
      );
    }

    // Spec §11.2 path 2: the local domain's outbound reply_credential becomes
    // the new contact's local_credential; the inbound envelope's
    // reply_credential becomes the contact's remote_credential.
    await this.contactManager.upsertFromInvitationReply({
      ownerOid: invitation.owner_oid,
      remoteDomain: invitation.remote_domain,
      remoteDomainId,
      remoteTerms: envelope.communication_terms,
      localTerms: invitation.communication_terms,
      localCredential: invitation.reply_credential,
      remoteCredential: envelope.reply_credential,
      claims: envelope.claims,
      recordedAt: now,
    });

    await this.invitationManager.markOutboundAccepted(
      invitation.invitation_id,
      now,
    );

    return { envelopeId: invitation.invitation_id };
  }
}

// Re-export Invitation*MismatchError to make IDE imports easier from controller.
export { InvitationDirectionMismatchError };

// ---------- Message handler ----------

const NON_MESSAGE_CATEGORIES = new Set<string>([
  "invitation",
  "invitation_reply",
]);

export class MessageEnvelopeHandler {
  constructor(
    private readonly messageManager: MessageManager,
    private readonly contactManager: ContactManager,
  ) {}

  async handle(
    envelope: MessageEnvelope,
    contactId: string,
    now: Date,
  ): Promise<EnvelopeHandlerResult> {
    if (NON_MESSAGE_CATEGORIES.has(envelope.category)) {
      throw new InvalidMessageEnvelopeError(
        `category "${envelope.category}" is reserved for control envelopes`,
      );
    }

    // Re-fetch the contact for the route check, then verify sender_domain.
    const contact = await this.contactManager.getByLocalCredentialId(contactId);
    if (!contact) {
      // Should never happen — controller already resolved this contact.
      throw new InvalidMessageEnvelopeError(
        `contact ${contactId} not found during message handling`,
      );
    }
    if (contact.blocked) throw new ContactBlockedError(contact.id);
    if (
      contact.remote_domain.toLowerCase() !==
        envelope.sender_domain.toLowerCase()
    ) {
      throw new ContactSenderDomainMismatchError(
        contact.remote_domain,
        envelope.sender_domain,
      );
    }

    // Spec §10.1 / req:contacts-011: receiver MUST enforce its own
    // local_terms on every inbound message envelope.
    if (!contact.local_terms.categories.includes(envelope.category)) {
      throw new CategoryNotPermittedError(envelope.category);
    }
    const maxAllowed = CONTENT_RATINGS.indexOf(
      contact.local_terms.max_content_rating,
    );
    const incoming = CONTENT_RATINGS.indexOf(envelope.content_rating);
    if (incoming > maxAllowed) {
      throw new ContentRatingNotPermittedError(
        envelope.content_rating,
        contact.local_terms.max_content_rating,
      );
    }

    await this.messageManager.store({
      oid: contact.owner_oid,
      contactId: contact.id,
      remoteDomain: contact.remote_domain,
      messageId: envelope.message_id,
      category: envelope.category,
      contentRating: envelope.content_rating,
      sentAt: envelope.sent_at,
      receivedAt: now,
      subject: envelope.subject,
      body: envelope.body,
      ...(envelope.metadata !== undefined && { metadata: envelope.metadata }),
    });

    return { envelopeId: envelope.message_id };
  }
}
