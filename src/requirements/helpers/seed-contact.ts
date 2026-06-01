import { generate as generateUUIDv7 } from "@std/uuid/v7";
import { encodeHex } from "@std/encoding/hex";

export interface ContactCredentialSeed {
  contact_id: string;
  contact_secret: string;
}

export interface CommunicationTermsSeed {
  categories: string[];
  max_content_rating: string;
}

export interface SeedContactOptions {
  /** Local owner OID. */
  ownerOid: string;
  /** Remote party's RPP domain. */
  remoteDomain?: string;
  /** Remote party's domain_id (scoped to remote_domain). */
  remoteDomainId?: string;
  /** Communication terms the remote declared. */
  remoteTerms?: CommunicationTermsSeed;
  /** Communication terms the local user declared. */
  localTerms?: CommunicationTermsSeed;
  /** Credential the remote uses to sign envelopes inbound to the local domain. */
  localCredential?: ContactCredentialSeed;
  /** Credential the local domain uses to sign envelopes outbound. */
  remoteCredential?: ContactCredentialSeed;
  fields?: Record<
    string,
    Array<{
      value: unknown;
      source:
        | "sender_verified"
        | "domain_admin"
        | "sender_custom"
        | "owner_note";
      recorded_at: Date;
    }>
  >;
  blocked?: boolean;
}

export interface SeededContact {
  id: string;
  owner_oid: string;
  remote_domain: string;
  remote_domain_id: string;
  remote_terms: CommunicationTermsSeed;
  local_terms: CommunicationTermsSeed;
  local_credential: ContactCredentialSeed;
  remote_credential: ContactCredentialSeed;
  blocked: boolean;
}

function randomSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeHex(bytes);
}

export function makeCredential(): ContactCredentialSeed {
  return {
    contact_id: generateUUIDv7(),
    contact_secret: randomSecret(),
  };
}

const DEFAULT_TERMS: CommunicationTermsSeed = {
  categories: ["correspondence"],
  max_content_rating: "PG",
};

/**
 * Seed a bilateral contact directly into KV using the same key layout as
 * `ContactRepository`. Returns the full contact object plus credentials so
 * tests can immediately submit envelopes against it.
 */
export async function seedContact(
  kv: Deno.Kv,
  opts: SeedContactOptions,
): Promise<SeededContact> {
  const id = generateUUIDv7();
  const now = new Date();
  const contact = {
    id,
    owner_oid: opts.ownerOid,
    remote_domain: opts.remoteDomain ?? "remote.example",
    remote_domain_id: opts.remoteDomainId ?? generateUUIDv7(),
    remote_terms: opts.remoteTerms ?? DEFAULT_TERMS,
    local_terms: opts.localTerms ?? DEFAULT_TERMS,
    local_credential: opts.localCredential ?? makeCredential(),
    remote_credential: opts.remoteCredential ?? makeCredential(),
    fields: opts.fields ?? {},
    blocked: opts.blocked ?? false,
    created_at: now,
    updated_at: now,
  };

  const route = { owner_oid: contact.owner_oid, contact_id: contact.id };

  await kv.atomic()
    .set(["contacts", contact.owner_oid, contact.id], contact)
    .set(["contacts_by_oid", contact.owner_oid, contact.id], contact.id)
    .set(
      [
        "contacts_by_domain_key",
        contact.owner_oid,
        contact.remote_domain.toLowerCase(),
        contact.remote_domain_id,
      ],
      contact.id,
    )
    .set(
      ["contacts_by_local_cred", contact.local_credential.contact_id],
      route,
    )
    .commit();

  return contact;
}
