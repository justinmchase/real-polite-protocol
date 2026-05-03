import { z } from "zod";
import { CONTENT_RATINGS } from "../content-rating.ts";
import { MESSAGE_CATEGORIES } from "../message-category.ts";

export const InvitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
  "undelivered",
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

const UsagePolicySchema = z.enum(["one-time", "multiple-time", "any-time"]);

/**
 * Terms proposed or negotiated for a receipt. The spec defines one category
 * per receipt (Section 6.1); `category` is singular.
 */
export const ReceiptTermsSchema = z.object({
  category: z.enum(MESSAGE_CATEGORIES),
  max_content_rating: z.enum(CONTENT_RATINGS).optional(),
  usage_policy: UsagePolicySchema.optional(),
  validity_constraints: z.record(z.string(), z.unknown()).optional(),
  /** Maximum uses within the defined interval (only meaningful for `multiple-time` usage_policy). */
  interval_budget: z.number().int().positive().optional(),
}).catchall(z.unknown());

export type ReceiptTerms = z.infer<typeof ReceiptTermsSchema>;

/**
 * Optional contextual claims attached by the sender to help the receiver
 * decide whether to accept the invitation.
 */
export const InvitationClaimsSchema = z.object({
  /** Server-assigned immutable claims (e.g. domain_id). Always present on every envelope. */
  immutable: ClaimMapSchema,
  /** Claims the sending server has verified against the sender's identity token. */
  user: ClaimMapSchema.optional(),
  /** Claims asserted by the sending server's administrator. */
  admin: ClaimMapSchema.optional(),
  /** Unverified free-form claims provided by the sender (e.g. a personal note). */
  custom: ClaimMapSchema.optional(),
});

export type InvitationClaims = z.infer<typeof InvitationClaimsSchema>;

export const InvitationDeliverySchema = z.object({
  domain: z.string(),
  token: z.string(),
});

export const InvitationSchema = z.object({
  invitation_id: z.string(),
  receiver_oid: z.string(),
  /** OID of the sender when both parties share the same domain (same-domain delivery). */
  sender_oid: z.string().optional(),
  sender_domain: z.string(),
  status: InvitationStatusSchema,
  proposed_terms: ReceiptTermsSchema,
  claims: InvitationClaimsSchema.optional(),
  expires_at: z.coerce.date().optional(),
  created_at: z.coerce.date(),
  accepted_at: z.coerce.date().optional(),
  message_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  delivery: InvitationDeliverySchema.optional(),
});

export type Invitation = z.infer<typeof InvitationSchema>;
