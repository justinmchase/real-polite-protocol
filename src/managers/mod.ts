import { AccountManager } from "./account/mod.ts";
import { DomainIdentityManager } from "./domain-identity/mod.ts";
import { ReceptivePolicyManager } from "./receptive-policy/mod.ts";
import { InvitationManager } from "./invitation/mod.ts";
import { ReceiptManager } from "./receipt/mod.ts";
import type { Repositories } from "../repositories/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./domain-identity/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitation/mod.ts";
export * from "./receipt/mod.ts";

export interface Managers {
  accounts: AccountManager;
  domainIdentity: DomainIdentityManager;
  receptivePolicy: ReceptivePolicyManager;
  invitations: InvitationManager;
  receipts: ReceiptManager;
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
  const receipts = new ReceiptManager(repositories.receipts);
  const invitations = new InvitationManager(repositories.invitations, receipts);
  return { accounts, domainIdentity, receptivePolicy, invitations, receipts };
}
