import {
  type ReceptivePolicy,
  ReceptivePolicySchema,
} from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

/** Primary index: look up any policy by its own ID. */
const POLICY_BY_ID_PREFIX: Deno.KvKey = ["receptive_policies"];
/** Secondary index: list all policies belonging to a user. */
const POLICY_BY_OID_PREFIX: Deno.KvKey = ["receptive_policies_by_oid"];
/** Tertiary index: resolve a shortcode to a policy_id. */
const POLICY_BY_SHORTCODE_PREFIX: Deno.KvKey = [
  "receptive_policies_by_shortcode",
];

export class ReceptivePolicyRepository {
  constructor(private readonly kv: KvService) {}

  async add(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
    let op = this.kv.store.atomic()
      .set([...POLICY_BY_ID_PREFIX, policy.policy_id], policy)
      .set([...POLICY_BY_OID_PREFIX, policy.oid, policy.policy_id], policy);

    if (policy.shortcode) {
      op = op.set(
        [...POLICY_BY_SHORTCODE_PREFIX, policy.shortcode],
        policy.policy_id,
      );
    }

    await op.commit();
    return policy;
  }

  async update(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
    await this.kv.store.atomic()
      .set([...POLICY_BY_ID_PREFIX, policy.policy_id], policy)
      .set([...POLICY_BY_OID_PREFIX, policy.oid, policy.policy_id], policy)
      .commit();
    return policy;
  }

  async getById(policyId: string): Promise<ReceptivePolicy | undefined> {
    if (typeof policyId !== "string" || policyId.length === 0) return undefined;
    const entry = await this.kv.store.get<unknown>([
      ...POLICY_BY_ID_PREFIX,
      policyId,
    ]);
    return entry.value ? ReceptivePolicySchema.parse(entry.value) : undefined;
  }

  async getByShortcode(
    shortcode: string,
  ): Promise<ReceptivePolicy | undefined> {
    if (typeof shortcode !== "string" || shortcode.length === 0) {
      return undefined;
    }
    const entry = await this.kv.store.get<string>([
      ...POLICY_BY_SHORTCODE_PREFIX,
      shortcode,
    ]);
    if (!entry.value) return undefined;
    return await this.getById(entry.value);
  }

  async shortcodeExists(shortcode: string): Promise<boolean> {
    const entry = await this.kv.store.get([
      ...POLICY_BY_SHORTCODE_PREFIX,
      shortcode,
    ]);
    return entry.value !== null;
  }

  async listByOid(oid: string): Promise<ReceptivePolicy[]> {
    const prefix: Deno.KvKey = [...POLICY_BY_OID_PREFIX, oid];
    const iter = this.kv.store.list<unknown>({ prefix });
    const policies: ReceptivePolicy[] = [];
    for await (const entry of iter) {
      if (entry.value) policies.push(ReceptivePolicySchema.parse(entry.value));
    }
    return policies;
  }

  async delete(policyId: string): Promise<boolean> {
    const policy = await this.getById(policyId);
    if (!policy) return false;

    let op = this.kv.store.atomic()
      .delete([...POLICY_BY_ID_PREFIX, policyId])
      .delete([...POLICY_BY_OID_PREFIX, policy.oid, policyId]);

    if (policy.shortcode) {
      op = op.delete([...POLICY_BY_SHORTCODE_PREFIX, policy.shortcode]);
    }

    await op.commit();
    return true;
  }
}
