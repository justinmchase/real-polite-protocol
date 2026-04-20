import type {
  DomainIdentity,
  HistoricalVerificationKey,
  StoredDomainVerificationKey,
} from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import {
  type PaginatedResult,
  type PaginationInput,
  InvalidResumeTokenError,
  nextResumeToken,
  normalizePageSize,
  normalizeResumeToken,
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
    const entry = await this.kv.store.get<DomainIdentity>(DOMAIN_IDENTITY_KEY);
    return entry.value ?? undefined;
  }

  async set(identity: DomainIdentity): Promise<void> {
    await this.kv.store.set(DOMAIN_IDENTITY_KEY, identity);
  }

  async getActiveVerificationKey(): Promise<
    StoredDomainVerificationKey | undefined
  > {
    const entry = await this.kv.store.get<StoredDomainVerificationKey>(
      ACTIVE_VERIFICATION_KEY,
    );
    return entry.value ?? undefined;
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
    const entries = this.kv.store.list<HistoricalVerificationKey>({
      prefix: HISTORICAL_VERIFICATION_KEY_PREFIX,
    });
    const keys: HistoricalVerificationKey[] = [];
    for await (const entry of entries) {
      keys.push(entry.value);
    }
    return keys;
  }

  async listHistoricalVerificationKeysPage(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<HistoricalVerificationKey>> {
    const pageSize = normalizePageSize(pagination.page_size);
    const cursor = normalizeResumeToken(pagination.resume_token);

    let entries: Deno.KvListIterator<HistoricalVerificationKey>;
    try {
      entries = this.kv.store.list<HistoricalVerificationKey>({
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
      keys.push(entry.value);
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
