import type { Contact } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

/** Primary store: keyed by the synthetic contact id. */
const CONTACT_PREFIX: Deno.KvKey = ["contacts"];
/** Index: list contacts by owner OID — maps to synthetic contact id. */
const CONTACT_BY_OID_PREFIX: Deno.KvKey = ["contacts_by_oid"];
/**
 * Index: look up a contact by the composite key (owner_oid, domain, domain_id).
 * Maps to the synthetic contact id.
 */
const CONTACT_BY_DOMAIN_KEY_PREFIX: Deno.KvKey = ["contacts_by_domain_key"];

export interface ListContactsOptions {
  pageSize?: number;
  cursor?: string;
}

export interface ListContactsResult {
  contacts: Contact[];
  nextCursor?: string;
}

export class ContactRepository {
  constructor(private readonly kv: KvService) {}

  /** Look up a contact by its synthetic id. */
  async get(ownerOid: string, contactId: string): Promise<Contact | undefined> {
    const entry = await this.kv.store.get<Contact>([
      ...CONTACT_PREFIX,
      ownerOid,
      contactId,
    ]);
    return entry.value ?? undefined;
  }

  /**
   * Look up a contact by the composite sender key `(ownerOid, domain, domainId)`.
   * Returns undefined when no contact exists for that composite key.
   */
  async getByDomainKey(
    ownerOid: string,
    domain: string,
    domainId: string,
  ): Promise<Contact | undefined> {
    const entry = await this.kv.store.get<string>([
      ...CONTACT_BY_DOMAIN_KEY_PREFIX,
      ownerOid,
      domain.toLowerCase(),
      domainId,
    ]);
    if (!entry.value) return undefined;
    return await this.get(ownerOid, entry.value);
  }

  async set(contact: Contact): Promise<Contact> {
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
          contact.domain.toLowerCase(),
          contact.domain_id,
        ],
        contact.id,
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
        existing.domain.toLowerCase(),
        existing.domain_id,
      ])
      .commit();
    return true;
  }

  async listByOid(
    ownerOid: string,
    opts: ListContactsOptions = {},
  ): Promise<ListContactsResult> {
    const { pageSize = 50, cursor } = opts;
    const prefix = [...CONTACT_BY_OID_PREFIX, ownerOid];
    const listOpts: Deno.KvListOptions = { limit: pageSize };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const contacts: Contact[] = [];

    for await (const entry of iter) {
      const contact = await this.get(ownerOid, entry.value);
      if (contact) contacts.push(contact);
    }

    return { contacts, nextCursor: nextResumeToken(iter.cursor) };
  }
}
