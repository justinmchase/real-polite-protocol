export type ReceiptStatus = "active" | "revoked" | "expired";

export type RevocationReason =
  | "SENDER_REQUEST"
  | "CATEGORY_VIOLATION"
  | "RATING_VIOLATION"
  | "SPAM"
  | "ABUSE"
  | "OTHER";

export interface Receipt {
  /** Stable identifier — used in the x-rpp-receipt-id header. */
  id: string;
  /** HMAC-SHA-256 shared secret used to verify submit requests. */
  secret: string;
  /** OID of the receiver account that issued this receipt. */
  oid: string;
  /** Domain this receipt was issued to (the sender). */
  sender_domain: string;
  /** Permitted message category (per Section 6.4). */
  category: string;
  /** Maximum content rating the receiver will accept (per Section 6.5). */
  max_content_rating: string;
  /** How many times this receipt may be used. */
  usage_policy: "one-time" | "multiple-time" | "any-time";
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
