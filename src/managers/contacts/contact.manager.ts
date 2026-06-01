import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type {
  CommunicationTerms,
  ContactCredential,
  InvitationClaims,
} from "../../models/invitation/invitation.model.ts";
import type {
  Contact,
  ContactFieldRecord,
  ContactFieldSource,
  CurrentContactFields,
} from "../../models/mod.ts";
import type { ContactRepository } from "../../repositories/mod.ts";
import type {
  ListContactsOptions,
  ListContactsResult,
} from "../../repositories/contacts/contact.repository.ts";
import { ContactNotFoundError } from "./contact.error.ts";
import { generateContactCredential } from "./credential.ts";

/**
 * Minimal structural dependency the contact manager needs to cascade-delete
 * stored messages when a contact is removed (spec §11.6 / req:contacts-005).
 * Declared structurally so this module does not import MessageManager and
 * create a circular dependency.
 */
export interface MessageCascade {
  deleteByContact(oid: string, contactId: string): Promise<number>;
}

/** Derive the flat-merged view (most-recent value per field) from a contact. */
export function flatMerge(
  fields: Record<string, ContactFieldRecord[]>,
): CurrentContactFields {
  const result: CurrentContactFields = {};
  for (const [key, records] of Object.entries(fields)) {
    if (records.length > 0) result[key] = records[0];
  }
  return result;
}

export interface UpsertFromInboundInvitationInput {
  ownerOid: string;
  remoteDomain: string;
  remoteDomainId: string;
  /** Communication terms declared by the remote in the invitation envelope. */
  remoteTerms: CommunicationTerms;
  /** Communication terms supplied by the local user when accepting. */
  localTerms: CommunicationTerms;
  /** Credential the remote supplied in `invitation.reply_credential`. */
  remoteCredential: ContactCredential;
  /** Optional claims from the inbound invitation envelope. */
  claims?: InvitationClaims;
  recordedAt: Date;
}

export interface UpsertFromInvitationReplyInput {
  ownerOid: string;
  remoteDomain: string;
  remoteDomainId: string;
  /** Communication terms declared by the remote in the invitation_reply envelope. */
  remoteTerms: CommunicationTerms;
  /** Communication terms the local user originally proposed in the outbound invitation. */
  localTerms: CommunicationTerms;
  /** Credential the remote supplied in `invitation_reply.reply_credential`. */
  remoteCredential: ContactCredential;
  /** Credential the local domain originally generated when sending the invitation. */
  localCredential: ContactCredential;
  /** Optional claims from the inbound invitation_reply envelope. */
  claims?: InvitationClaims;
  recordedAt: Date;
}

export class ContactManager {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly messageCascade: MessageCascade,
  ) {}

  /**
   * Upsert a contact when the local user accepts an inbound invitation
   * (spec §11.2 path 1). The local domain generates a fresh `local_credential`
   * which the remote will use as the HMAC key for inbound envelopes; the
   * caller is responsible for transmitting that credential to the remote in
   * the `invitation_reply`.
   */
  async upsertFromInboundInvitation(
    input: UpsertFromInboundInvitationInput,
  ): Promise<Contact> {
    const existing = await this.contacts.getByDomainKey(
      input.ownerOid,
      input.remoteDomain,
      input.remoteDomainId,
    );

    const localCredential = existing?.local_credential ??
      generateContactCredential();

    const merged = mergeClaimFields(
      existing?.fields ?? {},
      input.claims,
      input.recordedAt,
    );

    const contact: Contact = {
      id: existing?.id ?? generateUUIDv7(),
      owner_oid: input.ownerOid,
      remote_domain: existing?.remote_domain ?? input.remoteDomain,
      remote_domain_id: existing?.remote_domain_id ?? input.remoteDomainId,
      remote_terms: input.remoteTerms,
      local_terms: input.localTerms,
      local_credential: localCredential,
      remote_credential: input.remoteCredential,
      fields: merged,
      blocked: existing?.blocked ?? false,
      created_at: existing?.created_at ?? input.recordedAt,
      updated_at: input.recordedAt,
    };
    return await this.contacts.set(contact);
  }

  /**
   * Upsert a contact when an `invitation_reply` is received in response to an
   * outbound invitation the local domain previously sent (spec §11.2 path 2).
   * The credential the local domain originally generated for the outbound
   * invitation becomes the contact's `local_credential`; the credential
   * carried in the reply becomes the contact's `remote_credential`.
   */
  async upsertFromInvitationReply(
    input: UpsertFromInvitationReplyInput,
  ): Promise<Contact> {
    const existing = await this.contacts.getByDomainKey(
      input.ownerOid,
      input.remoteDomain,
      input.remoteDomainId,
    );

    const merged = mergeClaimFields(
      existing?.fields ?? {},
      input.claims,
      input.recordedAt,
    );

    const contact: Contact = {
      id: existing?.id ?? generateUUIDv7(),
      owner_oid: input.ownerOid,
      remote_domain: existing?.remote_domain ?? input.remoteDomain,
      remote_domain_id: existing?.remote_domain_id ?? input.remoteDomainId,
      remote_terms: input.remoteTerms,
      local_terms: input.localTerms,
      local_credential: input.localCredential,
      remote_credential: input.remoteCredential,
      fields: merged,
      blocked: existing?.blocked ?? false,
      created_at: existing?.created_at ?? input.recordedAt,
      updated_at: input.recordedAt,
    };
    return await this.contacts.set(contact);
  }

  async get(ownerOid: string, contactId: string): Promise<Contact> {
    const contact = await this.contacts.get(ownerOid, contactId);
    if (!contact) throw new ContactNotFoundError(contactId);
    return contact;
  }

  async tryGet(
    ownerOid: string,
    contactId: string,
  ): Promise<Contact | undefined> {
    return await this.contacts.get(ownerOid, contactId);
  }

  async getByDomainKey(
    ownerOid: string,
    remoteDomain: string,
    remoteDomainId: string,
  ): Promise<Contact | undefined> {
    return await this.contacts.getByDomainKey(
      ownerOid,
      remoteDomain,
      remoteDomainId,
    );
  }

  /**
   * Resolve an inbound `x-rpp-contact-id` header value to a contact. Used by
   * envelope routing (spec §11.3 step 1).
   */
  async getByLocalCredentialId(
    localCredentialId: string,
  ): Promise<Contact | undefined> {
    return await this.contacts.getByLocalCredentialId(localCredentialId);
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
    // Spec §11.6 / req:contacts-005: deleting a contact cascade-deletes all
    // stored messages associated with that contact for this owner.
    await this.messageCascade.deleteByContact(ownerOid, contactId);
    return true;
  }

  async block(ownerOid: string, contactId: string): Promise<Contact> {
    return await this.setBlocked(ownerOid, contactId, true);
  }

  async unblock(ownerOid: string, contactId: string): Promise<Contact> {
    return await this.setBlocked(ownerOid, contactId, false);
  }

  private async setBlocked(
    ownerOid: string,
    contactId: string,
    blocked: boolean,
  ): Promise<Contact> {
    const contact = await this.contacts.get(ownerOid, contactId);
    if (!contact) throw new ContactNotFoundError(contactId);
    if (contact.blocked === blocked) return contact;
    return await this.contacts.set({
      ...contact,
      blocked,
      updated_at: new Date(),
    });
  }

  /** Add a custom (owner-supplied) field value to a contact. */
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
    return await this.contacts.set({
      ...contact,
      fields: { ...contact.fields, [key]: [record, ...existing] },
      updated_at: record.recorded_at,
    });
  }
}

function mergeClaimFields(
  base: Record<string, ContactFieldRecord[]>,
  claims: InvitationClaims | undefined,
  recordedAt: Date,
): Record<string, ContactFieldRecord[]> {
  const merged: Record<string, ContactFieldRecord[]> = { ...base };
  const namespaces: {
    data: Record<string, unknown> | undefined;
    source: ContactFieldSource;
  }[] = [
    { data: claims?.user, source: "sender_verified" },
    { data: claims?.admin, source: "domain_admin" },
    { data: claims?.custom, source: "sender_custom" },
  ];

  for (const { data, source } of namespaces) {
    if (!data) continue;
    for (const [key, value] of Object.entries(data)) {
      const record: ContactFieldRecord = {
        value: value as ContactFieldRecord["value"],
        source,
        recorded_at: recordedAt,
      };
      merged[key] = [record, ...(merged[key] ?? [])];
    }
  }

  return merged;
}
