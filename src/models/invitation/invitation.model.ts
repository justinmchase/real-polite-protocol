import { z } from "zod";
import { CONTENT_RATINGS } from "../content-rating.ts";
import { MESSAGE_CATEGORIES } from "../message-category.ts";

/** Direction of a stored invitation record relative to the local domain. */
export const InvitationDirectionSchema = z.enum(["inbound", "outbound"]);
export type InvitationDirection = z.infer<typeof InvitationDirectionSchema>;

export const InvitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const ClaimValueSchema: z.ZodType<
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[]
> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

export type ClaimValue = z.infer<typeof ClaimValueSchema>;

const ClaimMapSchema = z.record(z.string(), ClaimValueSchema);

/**
 * Communication terms declared by one side of an invitation exchange. Both
 * `categories` and `max_content_rating` are required (spec §10.1).
 */
export const CommunicationTermsSchema = z.object({
  categories: z.array(z.enum(MESSAGE_CATEGORIES)).min(1),
  max_content_rating: z.enum(CONTENT_RATINGS),
});

export type CommunicationTerms = z.infer<typeof CommunicationTermsSchema>;

/**
 * Per-contact credential carried in invitation / invitation_reply envelopes.
 * The owner of the credential is the side whose domain generated it; the
 * other side uses it as the HMAC key for envelopes flowing toward the
 * generating domain.
 */
export const ContactCredentialSchema = z.object({
  contact_id: z.string(),
  contact_secret: z.string(),
});

export type ContactCredential = z.infer<typeof ContactCredentialSchema>;

/**
 * Optional contextual claims attached by the sending side to help the
 * receiving side decide whether to accept (or, on reply, to enrich the
 * contact). See spec §10.6.
 *
 * `immutable.domain_id` is REQUIRED on every invitation and invitation_reply
 * envelope (spec §10.6 / req:submit-004 / req:invitations-004): it is the
 * sender's stable, admin-verified domain_id used for downstream contact
 * routing.
 */
export const InvitationClaimsSchema = z.object({
  immutable: ClaimMapSchema.refine(
    (m) => typeof m.domain_id === "string" && m.domain_id.length > 0,
    { message: "claims.immutable.domain_id is required" },
  ),
  user: ClaimMapSchema.optional(),
  admin: ClaimMapSchema.optional(),
  custom: ClaimMapSchema.optional(),
});

export type InvitationClaims = z.infer<typeof InvitationClaimsSchema>;

/**
 * A persisted invitation record. The same schema covers both inbound (received
 * from a remote sender) and outbound (sent by a local user) records,
 * discriminated by `direction`.
 */
export const InvitationSchema = z.object({
  invitation_id: z.string(),
  direction: InvitationDirectionSchema,
  /** OID of the local account that owns this record. */
  owner_oid: z.string(),
  /**
   * The remote party's domain. For inbound records this is the sender's
   * domain; for outbound records this is the receiver's domain.
   */
  remote_domain: z.string(),
  status: InvitationStatusSchema,
  /** Communication terms declared by the originating side of THIS record. */
  communication_terms: CommunicationTermsSchema,
  /**
   * Credential the originating side included for the other side to use when
   * replying. For inbound: credential the local domain will use for outbound
   * to the remote. For outbound: credential the local domain generated for
   * the remote to use when replying.
   */
  reply_credential: ContactCredentialSchema,
  claims: InvitationClaimsSchema.optional(),
  sender_display_name: z.string().optional(),
  message: z.string().optional(),
  expires_at: z.coerce.date().optional(),
  sent_at: z.coerce.date(),
  created_at: z.coerce.date(),
  decided_at: z.coerce.date().optional(),
});

export type Invitation = z.infer<typeof InvitationSchema>;

/**
 * Wire shape of an `invitation` envelope as defined in §10.1. Used for parsing
 * inbound envelopes and constructing outbound envelopes.
 */
export const InvitationEnvelopeSchema = z.object({
  category: z.literal("invitation"),
  invitation_id: z.string(),
  sender_domain: z.string(),
  sender_display_name: z.string().optional(),
  receptive_policy_id: z.string().optional(),
  shortcode: z.string().optional(),
  sent_at: z.coerce.date(),
  expires_at: z.coerce.date().optional(),
  communication_terms: CommunicationTermsSchema,
  reply_credential: ContactCredentialSchema,
  claims: InvitationClaimsSchema,
  message: z.string().optional(),
  cancelled: z.boolean().optional(),
});

export type InvitationEnvelope = z.infer<typeof InvitationEnvelopeSchema>;

/**
 * Wire shape of an `invitation_reply` envelope as defined in §10.4.
 */
export const InvitationReplyEnvelopeSchema = z.object({
  category: z.literal("invitation_reply"),
  invitation_id: z.string(),
  sender_domain: z.string(),
  sender_display_name: z.string().optional(),
  sent_at: z.coerce.date(),
  communication_terms: CommunicationTermsSchema,
  reply_credential: ContactCredentialSchema,
  claims: InvitationClaimsSchema,
  message: z.string().optional(),
});

export type InvitationReplyEnvelope = z.infer<
  typeof InvitationReplyEnvelopeSchema
>;
