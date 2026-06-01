import { type Contact, upcastContact } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

/** Primary store: keyed by (owner_oid, contact_id). */
const CONTACT_PREFIX: Deno.KvKey = ["contacts"];
/** Index: list contacts by owner OID. Maps to synthetic contact id. */
const CONTACT_BY_OID_PREFIX: Deno.KvKey = ["contacts_by_oid"];
/**
 * Composite-key lookup: `(owner_oid, remote_domain, remote_domain_id)` →
 * contact id. Used during invitation acceptance to detect re-invitations.
 */
const CONTACT_BY_DOMAIN_KEY_PREFIX: Deno.KvKey = ["contacts_by_domain_key"];
/**
 * Inbound HMAC routing index: `local_credential.contact_id` → (owner_oid,
 * contact_id). Spec §11.3 step 1: when an envelope arrives with
 * `x-rpp-contact-id`, the local domain looks up the contact by this id.
 */
const CONTACT_BY_LOCAL_CRED_PREFIX: Deno.KvKey = ["contacts_by_local_cred"];

export interface ContactRoute {
  owner_oid: string;
  contact_id: string;
}

export interface ListContactsOptions {
  pageSize?: number;
  cursor?: string;
  /** When true include blocked contacts; when false omit them. Default: include all. */
  blocked?: boolean;
}

export interface ListContactsResult {
  contacts: Contact[];
  nextCursor?: string;
}

export class ContactRepository {
  constructor(private readonly kv: KvService) {}

  async get(ownerOid: string, contactId: string): Promise<Contact | undefined> {
    const entry = await this.kv.store.get<unknown>([
      ...CONTACT_PREFIX,
      ownerOid,
      contactId,
    ]);
    if (!entry.value) return undefined;
    return upcastContact(entry.value).contact;
  }

  /** Look up by composite identity key `(owner_oid, remote_domain, remote_domain_id)`. */
  async getByDomainKey(
    ownerOid: string,
    remoteDomain: string,
    remoteDomainId: string,
  ): Promise<Contact | undefined> {
    const entry = await this.kv.store.get<string>([
      ...CONTACT_BY_DOMAIN_KEY_PREFIX,
      ownerOid,
      remoteDomain.toLowerCase(),
      remoteDomainId,
    ]);
    if (!entry.value) return undefined;
    return await this.get(ownerOid, entry.value);
  }

  /**
   * Resolve an inbound `x-rpp-contact-id` header to the contact route. Returns
   * undefined when no contact has the given `local_credential.contact_id`.
   */
  async getByLocalCredentialId(
    localCredentialId: string,
  ): Promise<Contact | undefined> {
    const entry = await this.kv.store.get<ContactRoute>([
      ...CONTACT_BY_LOCAL_CRED_PREFIX,
      localCredentialId,
    ]);
    if (!entry.value) return undefined;
    return await this.get(entry.value.owner_oid, entry.value.contact_id);
  }

  async set(contact: Contact): Promise<Contact> {
    const route: ContactRoute = {
      owner_oid: contact.owner_oid,
      contact_id: contact.id,
    };
    await this.kv.store
      .atomic()
      .set([...CONTACT_PREFIX, contact.owner_oid, contact.id], contact)
      .set(
        [...CONTACT_BY_OID_PREFIX, contact.owner_oid, contact.id],
        contact.id,
      )
      .set(
        [
          ...CONTACT_BY_DOMAIN_KEY_PREFIX,
          contact.owner_oid,
          contact.remote_domain.toLowerCase(),
          contact.remote_domain_id,
        ],
        contact.id,
      )
      .set(
        [
          ...CONTACT_BY_LOCAL_CRED_PREFIX,
          contact.local_credential.contact_id,
        ],
        route,
      )
      .commit();
    return contact;
  }

  async delete(ownerOid: string, contactId: string): Promise<boolean> {
    const existing = await this.get(ownerOid, contactId);
    if (!existing) return false;
    await this.kv.store
      .atomic()
      .delete([...CONTACT_PREFIX, ownerOid, contactId])
      .delete([...CONTACT_BY_OID_PREFIX, ownerOid, contactId])
      .delete([
        ...CONTACT_BY_DOMAIN_KEY_PREFIX,
        ownerOid,
        existing.remote_domain.toLowerCase(),
        existing.remote_domain_id,
      ])
      .delete([
        ...CONTACT_BY_LOCAL_CRED_PREFIX,
        existing.local_credential.contact_id,
      ])
      .commit();
    return true;
  }

  async listByOid(
    ownerOid: string,
    opts: ListContactsOptions = {},
  ): Promise<ListContactsResult> {
    const { pageSize = 50, cursor, blocked } = opts;
    const prefix = [...CONTACT_BY_OID_PREFIX, ownerOid];
    const listOpts: Deno.KvListOptions = { limit: pageSize };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const contacts: Contact[] = [];

    for await (const entry of iter) {
      const contact = await this.get(ownerOid, entry.value);
      if (!contact) continue;
      if (blocked !== undefined && contact.blocked !== blocked) continue;
      contacts.push(contact);
    }

    return { contacts, nextCursor: nextResumeToken(iter.cursor) };
  }
}
