import type { Account, UserVerifiedMetadataRecord } from "../../models/mod.ts";
import { newAccount } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import {
  type PaginatedResult,
  type PaginationInput,
  InvalidResumeTokenError,
  nextResumeToken,
  normalizePageSize,
  normalizeResumeToken,
} from "../../utils/mod.ts";

const VERIFIED_METADATA_PREFIX: Deno.KvKey = ["accounts", "verified_metadata"];

interface StoredVerifiedMetadataRecord {
  oid: string;
  user_verified_fields?: Record<string, string>;
  admin_verified_fields?: Record<string, string>;
  verified_fields?: Record<string, string>;
  user_updated_at?: string;
  admin_updated_at?: string;
  updated_at: string;
}

export class AccountRepository {
  constructor(private readonly kv: KvService) {}

  private resolveVerifiedMetadata(
    record: StoredVerifiedMetadataRecord,
  ): UserVerifiedMetadataRecord {
    const userVerifiedFields = record.user_verified_fields ?? {};
    const adminVerifiedFields = record.admin_verified_fields ??
      record.verified_fields ?? {};
    return {
      oid: record.oid,
      user_verified_fields: userVerifiedFields,
      admin_verified_fields: adminVerifiedFields,
      verified_fields: {
        ...userVerifiedFields,
        ...adminVerifiedFields,
      },
      user_updated_at: record.user_updated_at,
      admin_updated_at: record.admin_updated_at ??
        (record.admin_verified_fields ? record.updated_at : undefined),
      updated_at: record.updated_at,
    };
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
    const entry = await this.kv.store.get<Account>(key);
    return entry.value ?? undefined;
  }

  async createByOid(oid: string): Promise<Account> {
    const key: Deno.KvKey = ["accounts", "by_oid", oid];
    const existing = await this.kv.store.get<Account>(key);
    if (existing.value) {
      return existing.value;
    }

    const account = newAccount(oid);
    const result = await this.kv.store.atomic()
      .check(existing)
      .set(key, account)
      .commit();

    if (result.ok) {
      return account;
    }

    const retry = await this.kv.store.get<Account>(key);
    if (retry.value) {
      return retry.value;
    }

    throw new Error("Failed to create account");
  }

  async ensureByOid(oid: string): Promise<Account> {
    const existing = await this.findByOid(oid);
    if (existing) {
      return existing;
    }
    return await this.createByOid(oid);
  }

  async getVerifiedMetadata(
    oid: string,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    const key: Deno.KvKey = [...VERIFIED_METADATA_PREFIX, oid];
    const entry = await this.kv.store.get<StoredVerifiedMetadataRecord>(key);
    return entry.value ? this.resolveVerifiedMetadata(entry.value) : undefined;
  }

  async setUserVerifiedMetadata(
    oid: string,
    userVerifiedFields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord> {
    const existing = await this.getVerifiedMetadata(oid);
    const timestamp = new Date().toISOString();
    const record: StoredVerifiedMetadataRecord = {
      oid,
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
    const timestamp = new Date().toISOString();
    const record: StoredVerifiedMetadataRecord = {
      oid,
      user_verified_fields: existing?.user_verified_fields ?? {},
      admin_verified_fields: adminVerifiedFields,
      user_updated_at: existing?.user_updated_at,
      admin_updated_at: timestamp,
      updated_at: timestamp,
    };
    return await this.writeVerifiedMetadata(record);
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
