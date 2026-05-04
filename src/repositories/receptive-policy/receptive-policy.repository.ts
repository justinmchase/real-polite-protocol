import {
  type ReceptivePolicy,
  ReceptivePolicySchema,
} from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

// Primary index: look up any policy by its own ID (used by send_invitation).
const POLICY_BY_ID_PREFIX: Deno.KvKey = ["receptive_policies"];
// Secondary index: list all policies belonging to a user.
const POLICY_BY_OID_PREFIX: Deno.KvKey = ["receptive_policies_by_oid"];
// Tertiary index: find receipt-mode policies by receipt_id.
const POLICY_BY_RECEIPT_ID_PREFIX: Deno.KvKey = [
  "receptive_policies_by_receipt_id",
];
// Quaternary index: resolve a shortcode to a policy_id.
const POLICY_BY_SHORTCODE_PREFIX: Deno.KvKey = [
  "receptive_policies_by_shortcode",
];

export class ReceptivePolicyRepository {
  constructor(private readonly kv: KvService) {}

  async add(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
    const byId: Deno.KvKey = [...POLICY_BY_ID_PREFIX, policy.policy_id];
    const byOid: Deno.KvKey = [
      ...POLICY_BY_OID_PREFIX,
      policy.oid,
      policy.policy_id,
    ];

    let op = this.kv.store.atomic()
      .set(byId, policy)
      .set(byOid, policy);

    // Index receipt-mode policies so they can be found by receipt_id.
    if (policy.mode === "receipt" && policy.receipt_id) {
      op = op.set(
        [
          ...POLICY_BY_RECEIPT_ID_PREFIX,
          policy.receipt_id,
          policy.policy_id,
        ],
        policy.policy_id,
      );
    }

    // Index shortcode → policy_id for time-bounded windows.
    if (policy.shortcode) {
      op = op.set(
        [...POLICY_BY_SHORTCODE_PREFIX, policy.shortcode],
        policy.policy_id,
      );
    }

    await op.commit();
    return policy;
  }

  /** Update an existing policy in-place (e.g. to deactivate it). */
  async update(policy: ReceptivePolicy): Promise<ReceptivePolicy> {
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
    if (typeof policyId !== "string" || policyId.length === 0) return undefined;
    const key: Deno.KvKey = [...POLICY_BY_ID_PREFIX, policyId];
    const entry = await this.kv.store.get<unknown>(key);
    return entry.value ? ReceptivePolicySchema.parse(entry.value) : undefined;
  }

  /** Resolve a shortcode to its policy. Returns undefined if not found. */
  async getByShortcode(
    shortcode: string,
  ): Promise<ReceptivePolicy | undefined> {
    if (typeof shortcode !== "string" || shortcode.length === 0) {
      return undefined;
    }
    const key: Deno.KvKey = [...POLICY_BY_SHORTCODE_PREFIX, shortcode];
    const entry = await this.kv.store.get<string>(key);
    if (!entry.value) return undefined;
    return await this.getById(entry.value);
  }

  /** Check whether a shortcode is already taken. */
  async shortcodeExists(shortcode: string): Promise<boolean> {
    const key: Deno.KvKey = [...POLICY_BY_SHORTCODE_PREFIX, shortcode];
    const entry = await this.kv.store.get(key);
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

  /** Find all receipt-mode policies for a given receipt_id. */
  async findByReceiptId(receiptId: string): Promise<ReceptivePolicy[]> {
    const prefix: Deno.KvKey = [
      ...POLICY_BY_RECEIPT_ID_PREFIX,
      receiptId,
    ];
    const iter = this.kv.store.list<string>({ prefix });
    const policies: ReceptivePolicy[] = [];
    for await (const entry of iter) {
      const policy = await this.getById(entry.value);
      if (policy) policies.push(policy);
    }
    return policies;
  }

  /**
   * Delete a policy by ID, removing all index entries atomically.
   * Returns true if found and deleted, false if not found.
   */
  async delete(policyId: string): Promise<boolean> {
    const policy = await this.getById(policyId);
    if (!policy) return false;

    const byId: Deno.KvKey = [...POLICY_BY_ID_PREFIX, policyId];
    const byOid: Deno.KvKey = [
      ...POLICY_BY_OID_PREFIX,
      policy.oid,
      policyId,
    ];

    let op = this.kv.store.atomic().delete(byId).delete(byOid);

    if (policy.mode === "receipt" && policy.receipt_id) {
      op = op.delete([
        ...POLICY_BY_RECEIPT_ID_PREFIX,
        policy.receipt_id,
        policyId,
      ]);
    }

    if (policy.shortcode) {
      op = op.delete([...POLICY_BY_SHORTCODE_PREFIX, policy.shortcode]);
    }

    await op.commit();
    return true;
  }
}
