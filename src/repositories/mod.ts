import { AccountRepository } from "./account/mod.ts";
import { DomainIdentityRepository } from "./domain-identity/mod.ts";
import { ReceptivePolicyRepository } from "./receptive-policy/mod.ts";
import { InvitationRepository } from "./invitation/mod.ts";
import { ReceiptRepository } from "./receipt/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./domain-identity/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitation/mod.ts";
export * from "./receipt/mod.ts";

export interface Repositories {
  accounts: AccountRepository;
  domainIdentity: DomainIdentityRepository;
  receptivePolicy: ReceptivePolicyRepository;
  invitations: InvitationRepository;
  receipts: ReceiptRepository;
}

export function initRepositories(
  services: Services,
): Repositories {
  const accounts = new AccountRepository(services.kv);
  const domainIdentity = new DomainIdentityRepository(services.kv);
  const receptivePolicy = new ReceptivePolicyRepository(services.kv);
  const invitations = new InvitationRepository(services.kv);
  const receipts = new ReceiptRepository(services.kv);
  return { accounts, domainIdentity, receptivePolicy, invitations, receipts };
}
