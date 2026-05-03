import { z } from "zod";
import { CONTENT_RATINGS } from "../content-rating.ts";
import { MESSAGE_CATEGORIES } from "../message-category.ts";

export const ReceiptStatusSchema = z.enum(["active", "revoked", "expired"]);
export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>;

export const RevocationReasonSchema = z.enum([
  "SENDER_REQUEST",
  "CATEGORY_VIOLATION",
  "RATING_VIOLATION",
  "SPAM",
  "ABUSE",
  "OTHER",
  "SUPERSEDED",
]);
export type RevocationReason = z.infer<typeof RevocationReasonSchema>;

/**
 * Usage policy governs how many times a receipt may be used:
 *
 * - `one-time`:       Receipt expires after a single successful submit.
 * - `multiple-time`:  Receipt expires after `interval_budget` uses (not yet enforced).
 * - `any-time`:       Receipt may be used an unlimited number of times.
 */
export const UsagePolicySchema = z.enum([
  "one-time",
  "multiple-time",
  "any-time",
]);
export type UsagePolicy = z.infer<typeof UsagePolicySchema>;

export const ReceiptSchema = z.object({
  id: z.string(),
  secret: z.string(),
  oid: z.string(),
  sender_domain: z.string(),
  sender_domain_id: z.string().optional(),
  category: z.enum(MESSAGE_CATEGORIES),
  max_content_rating: z.enum(CONTENT_RATINGS),
  usage_policy: UsagePolicySchema,
  status: ReceiptStatusSchema,
  invitation_id: z.string().optional(),
  /**
   * Same-domain sender receipts only: the OID of the message recipient on this
   * server. When set, `send_message` stores the delivered message under this OID
   * instead of `oid` (which identifies the receipt holder/sender).
   */
  recipient_oid: z.string().optional(),
  /**
   * Same-domain sender receipts only: the ID of the receiver-side receipt.
   * Used as the receipt_id when storing messages so the record is consistent
   * with what an HTTP delivery would have produced.
   */
  original_receipt_id: z.string().optional(),
  issued_at: z.coerce.date(),
  revoked_at: z.coerce.date().optional(),
  revocation_reason: RevocationReasonSchema.optional(),
  revocation_detail: z.string().optional(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
