import { AccountManager } from "./account/mod.ts";
import { ContactManager } from "./contacts/mod.ts";
import { DomainIdentityManager } from "./domain-identity/mod.ts";
import { ReceptivePolicyManager } from "./receptive-policy/mod.ts";
import { InvitationManager } from "./invitation/mod.ts";
import { MessageManager, SentMessageManager } from "./messages/mod.ts";
import type { Repositories } from "../repositories/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";
export * from "./contacts/mod.ts";
export * from "./domain-identity/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitation/mod.ts";
export * from "./messages/mod.ts";

export interface Managers {
  accounts: AccountManager;
  contacts: ContactManager;
  domainIdentity: DomainIdentityManager;
  receptivePolicy: ReceptivePolicyManager;
  invitations: InvitationManager;
  messages: MessageManager;
  sentMessages: SentMessageManager;
}

export function initManagers(
  repositories: Repositories,
  services: Services,
): Managers {
  const accounts = new AccountManager(repositories.accounts);
  const messages = new MessageManager(repositories.messages);
  const contacts = new ContactManager(repositories.contacts, messages);
  const domainIdentity = new DomainIdentityManager(
    repositories.domainIdentity,
    services.config,
  );
  const receptivePolicy = new ReceptivePolicyManager(
    repositories.receptivePolicy,
  );
  const invitations = new InvitationManager(repositories.invitations);
  const sentMessages = new SentMessageManager(repositories.sentMessages);
  return {
    accounts,
    contacts,
    domainIdentity,
    receptivePolicy,
    invitations,
    messages,
    sentMessages,
  };
}
