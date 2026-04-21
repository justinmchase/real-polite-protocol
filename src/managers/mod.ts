import { AccountManager } from "./account/mod.ts";
import { DomainIdentityManager } from "./domain-identity/mod.ts";
import { ReceptivePolicyManager } from "./receptive-policy/mod.ts";
import type { Repositories } from "../repositories/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./domain-identity/mod.ts";
export * from "./receptive-policy/mod.ts";

export interface Managers {
  accounts: AccountManager;
  domainIdentity: DomainIdentityManager;
  receptivePolicy: ReceptivePolicyManager;
}

export function initManagers(
  repositories: Repositories,
  services: Services,
): Managers {
  const accounts = new AccountManager(repositories.accounts);
  const domainIdentity = new DomainIdentityManager(
    repositories.domainIdentity,
    services.config,
  );
  const receptivePolicy = new ReceptivePolicyManager(
    repositories.receptivePolicy,
  );
  return { accounts, domainIdentity, receptivePolicy };
}
