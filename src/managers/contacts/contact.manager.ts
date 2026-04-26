import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type {
  Contact,
  ContactFieldRecord,
  ContactFieldSource,
  CurrentContactFields,
} from "../../models/mod.ts";
import type { InvitationClaims } from "../../models/invitation/invitation.model.ts";
import type { ContactRepository } from "../../repositories/mod.ts";
import type {
  ListContactsOptions,
  ListContactsResult,
} from "../../repositories/contacts/contact.repository.ts";

export class ContactNotFoundError extends Error {
  constructor(contactId: string) {
    super(`Contact not found: ${contactId}`);
    this.name = "ContactNotFoundError";
  }
}

/**
 * Derive the flat-merged view (most-recent value per field) from a contact.
 */
export function flatMerge(
  fields: Record<string, ContactFieldRecord[]>,
): CurrentContactFields {
  const result: CurrentContactFields = {};
  for (const [key, records] of Object.entries(fields)) {
    if (records.length > 0) result[key] = records[0];
  }
  return result;
}

export class ContactManager {
  constructor(private readonly contacts: ContactRepository) {}

  /**
   * Upsert a contact from an accepted invitation.
   *
   * The unique contact key is `(ownerOid, senderDomain, domainId)`. A new
   * synthetic `id` (UUID) is assigned on first creation. Subsequent calls for
   * the same composite key merge new field values on top.
   */
  async upsertFromInvitation(
    ownerOid: string,
    senderDomain: string,
    domainId: string,
    claims: InvitationClaims | undefined,
    recordedAt: Date,
  ): Promise<Contact> {
    const existing = await this.contacts.getByDomainKey(
      ownerOid,
      senderDomain,
      domainId,
    );

    const base: Contact = existing ?? {
      id: generateUUIDv7(),
      owner_oid: ownerOid,
      domain: senderDomain,
      domain_id: domainId,
      fields: {},
      created_at: recordedAt,
      updated_at: recordedAt,
    };

    // Merge each claim namespace into fields.
    const namespaces: {
      data: Record<string, unknown> | undefined;
      source: ContactFieldSource;
    }[] = [
      { data: claims?.user, source: "sender_verified" },
      { data: claims?.admin, source: "domain_admin" },
      { data: claims?.custom, source: "sender_custom" },
    ];

    const updatedFields: Record<string, ContactFieldRecord[]> = {
      ...base.fields,
    };

    for (const { data, source } of namespaces) {
      if (!data) continue;
      for (const [key, value] of Object.entries(data)) {
        const record: ContactFieldRecord = {
          value: value as ContactFieldRecord["value"],
          source,
          recorded_at: recordedAt,
        };
        const existing = updatedFields[key] ?? [];
        updatedFields[key] = [record, ...existing];
      }
    }

    const updated: Contact = {
      ...base,
      // domain and domain_id are immutable identity keys; they are not re-set here.
      fields: updatedFields,
      updated_at: recordedAt,
    };

    return await this.contacts.set(updated);
  }

  async get(ownerOid: string, contactId: string): Promise<Contact> {
    const contact = await this.contacts.get(ownerOid, contactId);
    if (!contact) throw new ContactNotFoundError(contactId);
    return contact;
  }

  async getByDomainKey(
    ownerOid: string,
    domain: string,
    domainId: string,
  ): Promise<Contact | undefined> {
    return await this.contacts.getByDomainKey(ownerOid, domain, domainId);
  }

  async list(
    ownerOid: string,
    opts?: ListContactsOptions,
  ): Promise<ListContactsResult> {
    return await this.contacts.listByOid(ownerOid, opts);
  }

  async delete(ownerOid: string, contactId: string): Promise<boolean> {
    const deleted = await this.contacts.delete(ownerOid, contactId);
    if (!deleted) throw new ContactNotFoundError(contactId);
    return true;
  }

  /**
   * Add a custom field value to a contact on behalf of the owner.
   */
  async setCustomField(
    ownerOid: string,
    contactId: string,
    key: string,
    value: ContactFieldRecord["value"],
  ): Promise<Contact> {
    const contact = await this.contacts.get(ownerOid, contactId);
    if (!contact) throw new ContactNotFoundError(contactId);

    const record: ContactFieldRecord = {
      value,
      source: "owner_note",
      recorded_at: new Date(),
    };
    const existing = contact.fields[key] ?? [];
    const updatedFields = {
      ...contact.fields,
      [key]: [record, ...existing],
    };
    return await this.contacts.set({
      ...contact,
      fields: updatedFields,
      updated_at: record.recorded_at,
    });
  }
}
