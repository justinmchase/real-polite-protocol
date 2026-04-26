import { z } from "zod";
import { ClaimValueSchema } from "../invitation/invitation.model.ts";

/** Which claim namespace a field value came from. */
export const ContactFieldSourceSchema = z.enum([
  "sender_verified",
  "domain_admin",
  "sender_custom",
  "owner_note",
]);

export type ContactFieldSource = z.infer<typeof ContactFieldSourceSchema>;

/**
 * One historical value for a single contact field key.
 */
export const ContactFieldRecordSchema = z.object({
  value: ClaimValueSchema,
  source: ContactFieldSourceSchema,
  recorded_at: z.coerce.date(),
});

export type ContactFieldRecord = z.infer<typeof ContactFieldRecordSchema>;

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
export const ContactSchema = z.object({
  id: z.string(),
  owner_oid: z.string(),
  domain: z.string(),
  domain_id: z.string(),
  fields: z.record(z.string(), z.array(ContactFieldRecordSchema)),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Contact = z.infer<typeof ContactSchema>;
