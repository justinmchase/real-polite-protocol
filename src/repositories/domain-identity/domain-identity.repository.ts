import type { DomainIdentity } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const DOMAIN_IDENTITY_KEY: Deno.KvKey = ["domain_identity"];

export class DomainIdentityRepository {
  constructor(private readonly kv: KvService) {}

  async get(): Promise<DomainIdentity | undefined> {
    const entry = await this.kv.store.get<DomainIdentity>(DOMAIN_IDENTITY_KEY);
    return entry.value ?? undefined;
  }

  async set(identity: DomainIdentity): Promise<void> {
    await this.kv.store.set(DOMAIN_IDENTITY_KEY, identity);
  }
}
