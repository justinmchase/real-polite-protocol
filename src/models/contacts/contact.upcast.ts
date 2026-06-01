import { type Contact, ContactSchema } from "./contact.model.ts";

/**
 * Default communication terms applied to a legacy contact during v0 → v1
 * upcast. The contact will be marked `blocked: true` so these placeholder
 * terms are never used for live messaging — the owner must re-invite to
 * restore real terms.
 */
const PLACEHOLDER_TERMS = {
  categories: ["correspondence"] as const,
  max_content_rating: "G" as const,
};

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Migrate a raw KV value to the current Contact shape. Returns the validated
 * Contact along with a flag indicating whether the value actually changed
 * (so eager backfill jobs can skip no-op writes).
 *
 * v0 → v1 changes:
 * - rename `domain` → `remote_domain`, `domain_id` → `remote_domain_id`
 * - supply placeholder `local_terms`, `remote_terms` (v0 didn't persist terms)
 * - supply placeholder `local_credential`, `remote_credential` (v0 didn't
 *   persist credentials); contact is marked `blocked: true` because these
 *   placeholders cannot sign real envelopes.
 * - default `blocked: false` when present
 *
 * The function is shape-driven and idempotent: passing an already-v1 record
 * returns `{ changed: false }`.
 */
export function upcastContact(
  raw: unknown,
): { contact: Contact; changed: boolean } {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("contact record is not an object");
  }
  const obj = raw as Record<string, unknown>;

  const isV0 = !("remote_domain" in obj) && "domain" in obj;
  if (!isV0) {
    return { contact: ContactSchema.parse(obj), changed: false };
  }

  const upgraded: Record<string, unknown> = {
    id: obj.id,
    owner_oid: obj.owner_oid,
    remote_domain: obj.domain,
    remote_domain_id: obj.domain_id,
    remote_terms: PLACEHOLDER_TERMS,
    local_terms: PLACEHOLDER_TERMS,
    local_credential: {
      contact_id: `legacy-${randomHex(8)}`,
      contact_secret: randomHex(32),
    },
    remote_credential: {
      contact_id: `legacy-${randomHex(8)}`,
      contact_secret: randomHex(32),
    },
    fields: obj.fields ?? {},
    blocked: true,
    created_at: obj.created_at,
    updated_at: obj.updated_at,
  };

  return { contact: ContactSchema.parse(upgraded), changed: true };
}
