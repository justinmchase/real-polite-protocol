import type { ReceptivePolicy } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const RECEPTIVE_POLICY_PREFIX: Deno.KvKey = ["receptive_policy"];

export class ReceptivePolicyRepository {
  constructor(private readonly kv: KvService) {}

  async get(oid: string): Promise<ReceptivePolicy | undefined> {
    const key: Deno.KvKey = [...RECEPTIVE_POLICY_PREFIX, oid];
    const entry = await this.kv.store.get<ReceptivePolicy>(key);
    return entry.value ?? undefined;
  }

  async set(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
    const key: Deno.KvKey = [...RECEPTIVE_POLICY_PREFIX, policy.oid];
    await this.kv.store.set(key, policy);
    return policy;
  }
}
