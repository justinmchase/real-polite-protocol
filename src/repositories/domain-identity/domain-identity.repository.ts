import {
  type DomainIdentity,
  DomainIdentitySchema,
  type HistoricalVerificationKey,
  HistoricalVerificationKeySchema,
  type StoredDomainVerificationKey,
  StoredDomainVerificationKeySchema,
} from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import {
  InvalidResumeTokenError,
  nextResumeToken,
  normalizePageSize,
  normalizeResumeToken,
  type PaginatedResult,
  type PaginationInput,
} from "../../utils/mod.ts";

const DOMAIN_IDENTITY_KEY: Deno.KvKey = ["domain_identity"];
const ACTIVE_VERIFICATION_KEY: Deno.KvKey = ["domain_verification", "active"];
const HISTORICAL_VERIFICATION_KEY_PREFIX: Deno.KvKey = [
  "domain_verification",
  "historical",
];

export class DomainIdentityRepository {
  constructor(private readonly kv: KvService) {}

  async get(): Promise<DomainIdentity | undefined> {
    const entry = await this.kv.store.get<unknown>(DOMAIN_IDENTITY_KEY);
    return entry.value ? DomainIdentitySchema.parse(entry.value) : undefined;
  }

  async set(identity: DomainIdentity): Promise<void> {
    await this.kv.store.set(DOMAIN_IDENTITY_KEY, identity);
  }

  async getActiveVerificationKey(): Promise<
    StoredDomainVerificationKey | undefined
  > {
    const entry = await this.kv.store.get<unknown>(
      ACTIVE_VERIFICATION_KEY,
    );
    return entry.value
      ? StoredDomainVerificationKeySchema.parse(entry.value)
      : undefined;
  }

  async setActiveVerificationKey(
    key: StoredDomainVerificationKey,
  ): Promise<void> {
    await this.kv.store.set(ACTIVE_VERIFICATION_KEY, key);
  }

  async appendHistoricalVerificationKey(
    key: HistoricalVerificationKey,
  ): Promise<void> {
    const kvKey: Deno.KvKey = [
      ...HISTORICAL_VERIFICATION_KEY_PREFIX,
      key.key_id,
    ];
    await this.kv.store.set(kvKey, key);
  }

  async listHistoricalVerificationKeys(): Promise<HistoricalVerificationKey[]> {
    const entries = this.kv.store.list<unknown>({
      prefix: HISTORICAL_VERIFICATION_KEY_PREFIX,
    });
    const keys: HistoricalVerificationKey[] = [];
    for await (const entry of entries) {
      keys.push(HistoricalVerificationKeySchema.parse(entry.value));
    }
    return keys;
  }

  async listHistoricalVerificationKeysPage(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<HistoricalVerificationKey>> {
    const pageSize = normalizePageSize(pagination.page_size);
    const cursor = normalizeResumeToken(pagination.resume_token);

    let entries: Deno.KvListIterator<unknown>;
    try {
      entries = this.kv.store.list<unknown>({
        prefix: HISTORICAL_VERIFICATION_KEY_PREFIX,
      }, {
        limit: pageSize,
        ...(cursor ? { cursor } : {}),
      });
    } catch {
      throw new InvalidResumeTokenError();
    }

    const keys: HistoricalVerificationKey[] = [];
    for await (const entry of entries) {
      keys.push(HistoricalVerificationKeySchema.parse(entry.value));
    }

    return {
      items: keys,
      next_resume_token: nextResumeToken(entries.cursor),
    };
  }

  async deleteHistoricalVerificationKey(keyId: string): Promise<void> {
    const kvKey: Deno.KvKey = [...HISTORICAL_VERIFICATION_KEY_PREFIX, keyId];
    await this.kv.store.delete(kvKey);
  }
}
