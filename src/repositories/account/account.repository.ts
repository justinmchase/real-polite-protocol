import type { Account, UserVerifiedMetadataRecord } from "../../models/mod.ts";
import { newAccount } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const VERIFIED_METADATA_PREFIX: Deno.KvKey = ["accounts", "verified_metadata"];

export class AccountRepository {
  constructor(private readonly kv: KvService) {}

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

  async setVerifiedMetadata(
    oid: string,
    verifiedFields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord> {
    const record: UserVerifiedMetadataRecord = {
      oid,
      verified_fields: verifiedFields,
      updated_at: new Date().toISOString(),
    };
    const key: Deno.KvKey = [...VERIFIED_METADATA_PREFIX, oid];
    await this.kv.store.set(key, record);
    return record;
  }

  async listVerifiedMetadata(): Promise<UserVerifiedMetadataRecord[]> {
    const entries = this.kv.store.list<UserVerifiedMetadataRecord>({
      prefix: VERIFIED_METADATA_PREFIX,
    });
    const records: UserVerifiedMetadataRecord[] = [];
    for await (const entry of entries) {
      records.push(entry.value);
    }
    return records;
  }
}
