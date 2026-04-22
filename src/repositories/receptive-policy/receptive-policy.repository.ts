import type { ReceptivePolicy } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

// Primary index: look up any policy by its own ID (used by send_invitation).
const POLICY_BY_ID_PREFIX: Deno.KvKey = ["receptive_policies"];
// Secondary index: list all policies belonging to a user.
const POLICY_BY_OID_PREFIX: Deno.KvKey = ["receptive_policies_by_oid"];

export class ReceptivePolicyRepository {
  constructor(private readonly kv: KvService) {}

  async add(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
    const byId: Deno.KvKey = [...POLICY_BY_ID_PREFIX, policy.policy_id];
    const byOid: Deno.KvKey = [
      ...POLICY_BY_OID_PREFIX,
      policy.oid,
      policy.policy_id,
    ];
    await this.kv.store.atomic()
      .set(byId, policy)
      .set(byOid, policy)
      .commit();
    return policy;
  }

  async getById(policyId: string): Promise<ReceptivePolicy | undefined> {
    const key: Deno.KvKey = [...POLICY_BY_ID_PREFIX, policyId];
    const entry = await this.kv.store.get<ReceptivePolicy>(key);
    return entry.value ?? undefined;
  }

  async listByOid(oid: string): Promise<ReceptivePolicy[]> {
    const prefix: Deno.KvKey = [...POLICY_BY_OID_PREFIX, oid];
    const iter = this.kv.store.list<ReceptivePolicy>({ prefix });
    const policies: ReceptivePolicy[] = [];
    for await (const entry of iter) {
      if (entry.value) policies.push(entry.value);
    }
    return policies;
  }
}
