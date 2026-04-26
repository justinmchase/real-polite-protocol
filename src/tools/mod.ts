export * from "./account/mod.ts";
export * from "./contacts/mod.ts";
export * from "./domain-admin/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitations/mod.ts";
export * from "./receipt/mod.ts";
export * from "./messages/mod.ts";
export * from "./tool-result.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "../context.ts";
import type {
  AccountManager,
  ContactManager,
  DomainIdentityManager,
  InvitationManager,
  MessageManager,
  ReceiptManager,
  ReceptivePolicyManager,
} from "../managers/mod.ts";
import type { ConfigService } from "../services/config/config.service.ts";
import { AccountTool } from "./account/account.tool.ts";
import { ContactTool } from "./contacts/contacts.tool.ts";
import { DomainAdminTool } from "./domain-admin/domain-admin.tool.ts";
import { ReceptivePolicyTool } from "./receptive-policy/receptive-policy.tool.ts";
import { InvitationTool } from "./invitations/invitations.tool.ts";
import { ReceiptTool } from "./receipt/receipt.tool.ts";
import { MessageTool } from "./messages/message.tool.ts";

export interface Tool {
  register(server: McpServer, auth: AuthInfo): void;
}

export function initTools(
  managers: {
    accounts: AccountManager;
    contacts: ContactManager;
    domainIdentity: DomainIdentityManager;
    receptivePolicy: ReceptivePolicyManager;
    invitations: InvitationManager;
    receipts: ReceiptManager;
    messages: MessageManager;
  },
  config: ConfigService,
): Tool[] {
  return [
    new AccountTool(managers.accounts),
    new ContactTool(
      managers.contacts,
      managers.invitations,
      managers.accounts,
      managers.domainIdentity,
      config,
    ),
    new DomainAdminTool(managers.accounts, managers.domainIdentity),
    new ReceptivePolicyTool(managers.receptivePolicy),
    new InvitationTool(
      managers.invitations,
      managers.accounts,
      managers.domainIdentity,
      config,
    ),
    new ReceiptTool(managers.receipts),
    new MessageTool(
      managers.receipts,
      managers.accounts,
      config,
      managers.messages,
      managers.contacts,
    ),
  ];
}
