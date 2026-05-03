import { AccountRepository } from "./account/mod.ts";
import { ContactRepository } from "./contacts/mod.ts";
import { DomainIdentityRepository } from "./domain-identity/mod.ts";
import { ReceptivePolicyRepository } from "./receptive-policy/mod.ts";
import { InvitationRepository } from "./invitation/mod.ts";
import { PublicInvitationRepository } from "./invitation/mod.ts";
import { ReceiptRepository } from "./receipt/mod.ts";
import { MessageRepository } from "./messages/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./contacts/mod.ts";
export * from "./domain-identity/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitation/mod.ts";
export * from "./receipt/mod.ts";
export * from "./messages/mod.ts";

export interface Repositories {
  accounts: AccountRepository;
  contacts: ContactRepository;
  domainIdentity: DomainIdentityRepository;
  receptivePolicy: ReceptivePolicyRepository;
  invitations: InvitationRepository;
  publicInvitations: PublicInvitationRepository;
  receipts: ReceiptRepository;
  messages: MessageRepository;
}

export function initRepositories(
  services: Services,
): Repositories {
  const accounts = new AccountRepository(services.kv);
  const contacts = new ContactRepository(services.kv);
  const domainIdentity = new DomainIdentityRepository(services.kv);
  const receptivePolicy = new ReceptivePolicyRepository(services.kv);
  const invitations = new InvitationRepository(services.kv, services.events);
  const publicInvitations = new PublicInvitationRepository(services.kv);
  const receipts = new ReceiptRepository(services.kv);
  const messages = new MessageRepository(services.kv, services.events);
  return {
    accounts,
    contacts,
    domainIdentity,
    receptivePolicy,
    invitations,
    publicInvitations,
    receipts,
    messages,
  };
}
