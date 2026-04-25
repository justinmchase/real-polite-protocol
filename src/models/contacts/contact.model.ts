import type { ClaimValue } from "../invitation/invitation.model.ts";

/** Which claim namespace a field value came from. */
export type ContactFieldSource = "sender_verified" | "domain_admin" | "sender_custom" | "owner_note";

/**
 * One historical value for a single contact field key.
 */
export interface ContactFieldRecord {
  value: ClaimValue;
  source: ContactFieldSource;
  recorded_at: string; // ISO 8601
}

/**
 * Flat-merged view: most recent value per field key.
 * Used in list responses and as the top-level `current_fields` on a contact.
 */
export type CurrentContactFields = Record<string, ContactFieldRecord>;

/**
 * A contact record representing a known sender identity on a receiver account.
 *
 * The unique contact key is `(owner_oid, domain, domain_id)`. Because `domain_id`
 * is scoped to its issuing domain, two domains that happen to issue the same UUID
 * produce DIFFERENT contacts. Matching on `domain_id` alone is invalid.
 */
export interface Contact {
  /** Server-assigned stable UUID identifier for this contact record. */
  id: string;
  /** OID of the account that owns this contact. */
  owner_oid: string;
  /** Issuing hostname of the contact (sender_domain from the accepted invitation). */
  domain: string;
  /**
   * `domain_id` UUID as issued by `domain`. Together with `domain` this forms
   * the stable composite identity `(domain, domain_id)`.
   */
  domain_id: string;
  /**
   * Claim fields with full history per key, ordered newest-first.
   * Keys come from invitation `user`, `admin`, and `custom` claim namespaces.
   */
  fields: Record<string, ContactFieldRecord[]>;
  created_at: string;
  updated_at: string;
}
