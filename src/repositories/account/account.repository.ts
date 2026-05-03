import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { Account, UserVerifiedMetadataRecord } from "../../models/mod.ts";
import {
  AccountSchema,
  newAccount,
  UserVerifiedMetadataRecordSchema,
} from "../../models/account/account.model.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import {
  AccountCreateConflictError,
  AccountNotFoundError,
  DomainIdAssignConflictError,
} from "../../tools/domain-admin/domain-admin.error.ts";
import {
  InvalidResumeTokenError,
  nextResumeToken,
  normalizePageSize,
  normalizeResumeToken,
  type PaginatedResult,
  type PaginationInput,
} from "../../utils/mod.ts";

const VERIFIED_METADATA_PREFIX: Deno.KvKey = ["accounts", "verified_metadata"];

interface StoredVerifiedMetadataRecord {
  oid: string;
  immutable_fields?: Record<string, string>;
  user_verified_fields?: Record<string, string>;
  admin_verified_fields?: Record<string, string>;
  verified_fields?: Record<string, string>;
  user_updated_at?: Date;
  admin_updated_at?: Date;
  updated_at: Date;
}

export class AccountRepository {
  constructor(private readonly kv: KvService) {}

  private resolveVerifiedMetadata(
    record: StoredVerifiedMetadataRecord,
  ): UserVerifiedMetadataRecord {
    const immutableFields = record.immutable_fields ?? {};
    const userVerifiedFields = record.user_verified_fields ?? {};
    const adminVerifiedFields = record.admin_verified_fields ??
      record.verified_fields ?? {};
    return UserVerifiedMetadataRecordSchema.parse({
      oid: record.oid,
      immutable_fields: immutableFields,
      user_verified_fields: userVerifiedFields,
      admin_verified_fields: adminVerifiedFields,
      // Merge order: user < admin < immutable (immutable has highest priority).
      verified_fields: {
        ...userVerifiedFields,
        ...adminVerifiedFields,
        ...immutableFields,
      },
      user_updated_at: record.user_updated_at,
      admin_updated_at: record.admin_updated_at ??
        (record.admin_verified_fields ? record.updated_at : undefined),
      updated_at: record.updated_at,
    });
  }

  private async writeVerifiedMetadata(
    record: StoredVerifiedMetadataRecord,
  ): Promise<UserVerifiedMetadataRecord> {
    const key: Deno.KvKey = [...VERIFIED_METADATA_PREFIX, record.oid];
    await this.kv.store.set(key, record);
    return this.resolveVerifiedMetadata(record);
  }

  async findByOid(oid: string): Promise<Account | undefined> {
    const key: Deno.KvKey = ["accounts", "by_oid", oid];
    const entry = await this.kv.store.get<unknown>(key);
    return entry.value ? AccountSchema.parse(entry.value) : undefined;
  }

  async createByOid(oid: string): Promise<Account> {
    const key: Deno.KvKey = ["accounts", "by_oid", oid];
    const existing = await this.kv.store.get<unknown>(key);
    if (existing.value) {
      return AccountSchema.parse(existing.value);
    }

    const account = newAccount(oid);
    const result = await this.kv.store.atomic()
      .check(existing)
      .set(key, account)
      .commit();

    if (result.ok) {
      return account;
    }

    const retry = await this.kv.store.get<unknown>(key);
    if (retry.value) {
      return AccountSchema.parse(retry.value);
    }

    throw new AccountCreateConflictError(oid);
  }

  async ensureByOid(oid: string): Promise<Account> {
    const existing = await this.findByOid(oid);
    if (existing) {
      return existing;
    }
    return await this.createByOid(oid);
  }

  async assignDomainId(oid: string): Promise<Account> {
    const key: Deno.KvKey = ["accounts", "by_oid", oid];
    const existing = await this.kv.store.get<unknown>(key);
    if (!existing.value) {
      throw new AccountNotFoundError(oid);
    }
    const existingAccount = AccountSchema.parse(existing.value);
    if (existingAccount.domain_id) {
      // Ensure index exists for legacy accounts written before the index existed.
      await this.kv.store.set(
        ["accounts", "by_domain_id", existingAccount.domain_id],
        oid,
      );
      return existingAccount;
    }
    const newDomainId = generateUUIDv7();
    const updated: Account = {
      ...existingAccount,
      domain_id: newDomainId,
    };
    const result = await this.kv.store.atomic()
      .check(existing)
      .set(key, updated)
      .set(["accounts", "by_domain_id", newDomainId], oid)
      .commit();
    if (result.ok) {
      return updated;
    }
    // Race: another request assigned it first, re-read.
    const retry = await this.kv.store.get<unknown>(key);
    if (retry.value) {
      const reread = AccountSchema.parse(retry.value);
      if (reread.domain_id) {
        await this.kv.store.set(
          ["accounts", "by_domain_id", reread.domain_id],
          oid,
        );
      }
      return reread;
    }
    throw new DomainIdAssignConflictError(oid);
  }

  /**
   * Look up an OID by domain_id. Reads the `["accounts", "by_domain_id", id]`
   * index. On miss (e.g. legacy account written before the index existed),
   * scans `["accounts", "by_oid"]` once to backfill.
   */
  async findOidByDomainId(domainId: string): Promise<string | undefined> {
    const indexKey: Deno.KvKey = ["accounts", "by_domain_id", domainId];
    const indexed = await this.kv.store.get<string>(indexKey);
    if (typeof indexed.value === "string") {
      return indexed.value;
    }
    // Lazy backfill: scan accounts.
    const entries = this.kv.store.list<unknown>({
      prefix: ["accounts", "by_oid"],
    });
    for await (const entry of entries) {
      const account = AccountSchema.parse(entry.value);
      if (account.domain_id) {
        await this.kv.store.set(
          ["accounts", "by_domain_id", account.domain_id],
          account.oid,
        );
        if (account.domain_id === domainId) {
          return account.oid;
        }
      }
    }
    return undefined;
  }

  async getVerifiedMetadata(
    oid: string,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    const key: Deno.KvKey = [...VERIFIED_METADATA_PREFIX, oid];
    const entry = await this.kv.store.get<StoredVerifiedMetadataRecord>(key);
    return entry.value
      ? this.resolveVerifiedMetadata(
        entry.value as StoredVerifiedMetadataRecord,
      )
      : undefined;
  }

  async setImmutableFields(
    oid: string,
    fields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord> {
    const existing = await this.getVerifiedMetadata(oid);
    const timestamp = new Date();
    const record: StoredVerifiedMetadataRecord = {
      oid,
      // Existing immutable values win — once written they cannot change.
      immutable_fields: { ...fields, ...(existing?.immutable_fields ?? {}) },
      user_verified_fields: existing?.user_verified_fields ?? {},
      admin_verified_fields: existing?.admin_verified_fields ?? {},
      user_updated_at: existing?.user_updated_at,
      admin_updated_at: existing?.admin_updated_at,
      updated_at: timestamp,
    };
    return await this.writeVerifiedMetadata(record);
  }

  async setUserVerifiedMetadata(
    oid: string,
    userVerifiedFields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord> {
    const existing = await this.getVerifiedMetadata(oid);
    const timestamp = new Date();
    const record: StoredVerifiedMetadataRecord = {
      oid,
      immutable_fields: existing?.immutable_fields ?? {},
      user_verified_fields: userVerifiedFields,
      admin_verified_fields: existing?.admin_verified_fields ?? {},
      user_updated_at: timestamp,
      admin_updated_at: existing?.admin_updated_at,
      updated_at: timestamp,
    };
    return await this.writeVerifiedMetadata(record);
  }

  async setAdminVerifiedMetadata(
    oid: string,
    adminVerifiedFields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord> {
    const existing = await this.getVerifiedMetadata(oid);
    const timestamp = new Date();
    const record: StoredVerifiedMetadataRecord = {
      oid,
      immutable_fields: existing?.immutable_fields ?? {},
      user_verified_fields: existing?.user_verified_fields ?? {},
      admin_verified_fields: adminVerifiedFields,
      user_updated_at: existing?.user_updated_at,
      admin_updated_at: timestamp,
      updated_at: timestamp,
    };
    return await this.writeVerifiedMetadata(record);
  }

  async setDisplayName(
    oid: string,
    displayName: string | null,
  ): Promise<Account> {
    const key: Deno.KvKey = ["accounts", "by_oid", oid];
    const existing = await this.kv.store.get<unknown>(key);
    if (!existing.value) {
      throw new AccountNotFoundError(oid);
    }
    const { display_name: _dn, ...base } = AccountSchema.parse(existing.value);
    const updated: Account = displayName !== null
      ? { ...base, display_name: displayName, updated_at: new Date() }
      : { ...base, updated_at: new Date() };
    await this.kv.store.set(key, updated);
    return updated;
  }

  async listVerifiedMetadata(): Promise<UserVerifiedMetadataRecord[]> {
    const entries = this.kv.store.list<StoredVerifiedMetadataRecord>({
      prefix: VERIFIED_METADATA_PREFIX,
    });
    const records: UserVerifiedMetadataRecord[] = [];
    for await (const entry of entries) {
      records.push(this.resolveVerifiedMetadata(entry.value));
    }
    return records;
  }

  async listVerifiedMetadataPage(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<UserVerifiedMetadataRecord>> {
    const pageSize = normalizePageSize(pagination.page_size);
    const cursor = normalizeResumeToken(pagination.resume_token);

    let entries: Deno.KvListIterator<StoredVerifiedMetadataRecord>;
    try {
      entries = this.kv.store.list<StoredVerifiedMetadataRecord>({
        prefix: VERIFIED_METADATA_PREFIX,
      }, {
        limit: pageSize,
        ...(cursor ? { cursor } : {}),
      });
    } catch {
      throw new InvalidResumeTokenError();
    }

    const records: UserVerifiedMetadataRecord[] = [];
    for await (const entry of entries) {
      records.push(this.resolveVerifiedMetadata(entry.value));
    }

    return {
      items: records,
      next_resume_token: nextResumeToken(entries.cursor),
    };
  }
}
