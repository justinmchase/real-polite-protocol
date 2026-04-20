import type { DomainIdentity } from "../../models/mod.ts";
import type { DomainIdentityRepository } from "../../repositories/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";

export type DomainIdentityUpdate = Partial<Omit<DomainIdentity, "domain">>;

export class DomainIdentityManager {
  constructor(
    private readonly domainIdentity: DomainIdentityRepository,
    private readonly config: ConfigService,
  ) {}

  async getDomainIdentity(): Promise<DomainIdentity> {
    const stored = await this.domainIdentity.get();
    if (stored) {
      return stored;
    }
    return {
      domain: this.config.domain,
      display_name: this.config.domain,
    };
  }

  async updateDomainIdentity(
    update: DomainIdentityUpdate,
  ): Promise<DomainIdentity> {
    const current = await this.getDomainIdentity();
    const updated: DomainIdentity = {
      ...current,
      ...update,
      domain: current.domain,
    };
    await this.domainIdentity.set(updated);
    return updated;
  }
}
