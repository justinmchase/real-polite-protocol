import { z } from "zod";
import {
  ClaimValueSchema,
  CommunicationTermsSchema,
  ContactCredentialSchema,
} from "../invitation/invitation.model.ts";

/** Which claim namespace a field value came from. */
export const ContactFieldSourceSchema = z.enum([
  "sender_verified",
  "domain_admin",
  "sender_custom",
  "owner_note",
]);

export type ContactFieldSource = z.infer<typeof ContactFieldSourceSchema>;

/** One historical value for a single contact field key. */
export const ContactFieldRecordSchema = z.object({
  value: ClaimValueSchema,
  source: ContactFieldSourceSchema,
  recorded_at: z.coerce.date(),
});

export type ContactFieldRecord = z.infer<typeof ContactFieldRecordSchema>;

/**
 * Flat-merged view: most recent value per field key. Used in list responses
 * and as the top-level `current_fields` on a contact.
 */
export type CurrentContactFields = Record<string, ContactFieldRecord>;

/**
 * A contact record representing a consented relationship between a local
 * account (`owner_oid`) and a remote sender. See spec §11.
 *
 * The composite key `(owner_oid, remote_domain, remote_domain_id)` is the
 * logical unique key. Matching on `remote_domain_id` alone is invalid —
 * `remote_domain_id` is scoped to its issuing domain.
 *
 * Each contact carries TWO credentials:
 *
 * - `local_credential` — credential the **remote** uses to sign envelopes
 *   inbound to the local domain. Set `x-rpp-contact-id:
 *   local_credential.contact_id` and HMAC with `local_credential.contact_secret`.
 * - `remote_credential` — credential the **local** domain uses to sign
 *   envelopes outbound to the remote domain.
 */
export const ContactSchema = z.object({
  id: z.string(),
  owner_oid: z.string(),
  remote_domain: z.string(),
  remote_domain_id: z.string(),
  remote_terms: CommunicationTermsSchema,
  local_terms: CommunicationTermsSchema,
  local_credential: ContactCredentialSchema,
  remote_credential: ContactCredentialSchema,
  fields: z.record(z.string(), z.array(ContactFieldRecordSchema)),
  blocked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Contact = z.infer<typeof ContactSchema>;
