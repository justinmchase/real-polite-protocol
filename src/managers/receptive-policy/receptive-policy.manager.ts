import type {
  DomainFilter,
  ReceptiveMode,
  ReceptivePolicy,
  WindowScope,
} from "../../models/mod.ts";
import { defaultReceptivePolicy } from "../../models/mod.ts";
import type { ReceptivePolicyRepository } from "../../repositories/mod.ts";

export class ReceptivePolicyManager {
  constructor(
    private readonly receptivePolicies: ReceptivePolicyRepository,
  ) {}

  async getPolicy(oid: string): Promise<ReceptivePolicy> {
    const stored = await this.receptivePolicies.get(oid);
    return stored ?? defaultReceptivePolicy(oid);
  }

  async setPolicy(
    oid: string,
    mode: ReceptiveMode,
    domainFilter?: DomainFilter,
  ): Promise<ReceptivePolicy> {
    const existing = await this.receptivePolicies.get(oid);
    const policy: ReceptivePolicy = {
      oid,
      mode,
      ...(mode === "domain_filter" && domainFilter
        ? { domain_filter: domainFilter }
        : {}),
      receptive_until: existing?.receptive_until,
      window_scope: existing?.window_scope,
      window_domain_filter: existing?.window_domain_filter,
      updated_at: new Date().toISOString(),
    };
    return await this.receptivePolicies.set(policy);
  }

  async openWindow(
    oid: string,
    durationSeconds: number,
    scope: WindowScope = "all",
    windowDomainFilter?: DomainFilter,
  ): Promise<ReceptivePolicy> {
    const existing = await this.receptivePolicies.get(oid);
    const receptiveUntil = new Date(
      Date.now() + durationSeconds * 1000,
    ).toISOString();
    const policy: ReceptivePolicy = {
      oid,
      mode: existing?.mode ?? "closed",
      domain_filter: existing?.domain_filter,
      receptive_until: receptiveUntil,
      window_scope: scope,
      ...(scope === "domain_filter" && windowDomainFilter
        ? { window_domain_filter: windowDomainFilter }
        : {}),
      updated_at: new Date().toISOString(),
    };
    return await this.receptivePolicies.set(policy);
  }
}
