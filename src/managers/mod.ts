import { AccountManager } from "./account/mod.ts";
import { DomainIdentityManager } from "./domain-identity/mod.ts";
import type { Repositories } from "../repositories/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./domain-identity/mod.ts";

export interface Managers {
  accounts: AccountManager;
  domainIdentity: DomainIdentityManager;
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
  return { accounts, domainIdentity };
}
