import type { Account } from "../../models/mod.ts";
import { newAccount } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

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
}
