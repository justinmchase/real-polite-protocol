import type {
  DomainFilter,
  ReceptiveMode,
  ReceptivePolicy,
} from "../../models/mod.ts";
import type { ReceptivePolicyRepository } from "../../repositories/mod.ts";

export class ReceptivePolicyManager {
  constructor(
    private readonly receptivePolicies: ReceptivePolicyRepository,
  ) {}

  async getPolicies(oid: string): Promise<ReceptivePolicy[]> {
    return await this.receptivePolicies.listByOid(oid);
  }

  async getById(policyId: string): Promise<ReceptivePolicy | undefined> {
    return await this.receptivePolicies.getById(policyId);
  }

  async addPolicy(
    oid: string,
    mode: ReceptiveMode,
    domainFilter?: DomainFilter,
  ): Promise<ReceptivePolicy> {
    const policy: ReceptivePolicy = {
      policy_id: crypto.randomUUID(),
      oid,
      mode,
      ...(mode === "domain_filter" && domainFilter
        ? { domain_filter: domainFilter }
        : {}),
      created_at: new Date().toISOString(),
    };
    return await this.receptivePolicies.add(policy);
  }

  async openWindow(
    oid: string,
    durationSeconds: number,
    scope: ReceptiveMode = "all",
    windowDomainFilter?: DomainFilter,
  ): Promise<ReceptivePolicy> {
    const receptiveUntil = new Date(
      Date.now() + durationSeconds * 1000,
    ).toISOString();
    const policy: ReceptivePolicy = {
      policy_id: crypto.randomUUID(),
      oid,
      mode: scope,
      ...(scope === "domain_filter" && windowDomainFilter
        ? { domain_filter: windowDomainFilter }
        : {}),
      receptive_until: receptiveUntil,
      created_at: new Date().toISOString(),
    };
    return await this.receptivePolicies.add(policy);
  }
}
