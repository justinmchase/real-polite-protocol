import type { ContentRating } from "../content-rating.ts";
import type { MessageCategory } from "../message-category.ts";

export type ReceiptStatus = "active" | "revoked" | "expired";

export type RevocationReason =
  | "SENDER_REQUEST"
  | "CATEGORY_VIOLATION"
  | "RATING_VIOLATION"
  | "SPAM"
  | "ABUSE"
  | "OTHER";

/**
 * Usage policy governs how many times a receipt may be used:
 *
 * - `one-time`:       Receipt expires after a single successful submit.
 * - `multiple-time`:  Receipt expires after `interval_budget` uses (not yet enforced).
 * - `any-time`:       Receipt may be used an unlimited number of times.
 *
 * TODO: enforce `one-time` expiry after first use and implement
 *       `interval_budget` counting for `multiple-time` receipts.
 */
export type UsagePolicy = "one-time" | "multiple-time" | "any-time";

export interface Receipt {
  /** Stable identifier — used in the x-rpp-receipt-id header. */
  id: string;
  /**
   * 64-character lowercase hex string representing 32 random bytes.
   * Used as the HMAC-SHA-256 key for submit request signature verification.
   */
  secret: string;
  /** OID of the receiver account that issued this receipt. */
  oid: string;
  /** Domain this receipt was issued to (the sender). */
  sender_domain: string;
  /** Permitted message category (per Section 6.4 / Section 7.2). */
  category: MessageCategory;
  /** Maximum content rating the receiver will accept (per Section 6.5 / Section 7.3). */
  max_content_rating: ContentRating;
  /** How many times this receipt may be used. */
  usage_policy: UsagePolicy;
  /** Current lifecycle state. Active → revoked or active → expired. */
  status: ReceiptStatus;
  /** Invitation that led to this receipt (for bulk revoke by invitation). */
  invitation_id?: string;
  /** ISO 8601 timestamp when this receipt was issued. */
  issued_at: string;
  /** ISO 8601 timestamp of revocation. Set when status becomes revoked. */
  revoked_at?: string;
  /** Structured revocation reason (Section 10A.1). */
  revocation_reason?: RevocationReason;
  /** Optional human-readable context for the revocation. */
  revocation_detail?: string;
}
