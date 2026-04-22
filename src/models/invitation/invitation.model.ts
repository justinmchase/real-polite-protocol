import type { ContentRating } from "../content-rating.ts";
import type { MessageCategory } from "../message-category.ts";
import type { UsagePolicy } from "../receipt/receipt.model.ts";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";

export type ClaimValue =
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[];

/**
 * Terms proposed or negotiated for a receipt. The spec defines one category
 * per receipt (Section 6.1); `category` is singular.
 */
export interface ReceiptTerms {
  category: MessageCategory;
  max_content_rating?: ContentRating;
  usage_policy?: UsagePolicy;
  validity_constraints?: Record<string, unknown>;
  /** Maximum uses within the defined interval (only meaningful for `multiple-time` usage_policy). */
  interval_budget?: number;
  [key: string]: unknown;
}

/**
 * Optional contextual claims attached by the sender to help the receiver
 * decide whether to accept the invitation.
 */
export interface InvitationClaims {
  /** Server-assigned immutable claims (e.g. domain_id). Always present on every envelope. */
  immutable: Record<string, ClaimValue>;
  /** Claims the sending server has verified against the sender's identity token. */
  user?: Record<string, ClaimValue>;
  /** Claims asserted by the sending server's administrator. */
  admin?: Record<string, ClaimValue>;
  /** Unverified free-form claims provided by the sender (e.g. a personal note). */
  custom?: Record<string, ClaimValue>;
}

export interface Invitation {
  invitation_id: string;
  receiver_oid: string;
  sender_domain: string;
  status: InvitationStatus;
  proposed_terms: Record<string, unknown>;
  claims?: InvitationClaims;
  expires_at?: string; // ISO 8601 timestamp, absent means indefinite
  created_at: string; // ISO 8601 timestamp
  accepted_at?: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}
