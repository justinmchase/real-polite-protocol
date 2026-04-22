export * from "./account/mod.ts";
export * from "./domain-admin/mod.ts";
export * from "./receptive-policy/mod.ts";
export * from "./invitations/mod.ts";
export * from "./tool-result.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "../context.ts";
import type {
  AccountManager,
  DomainIdentityManager,
  ReceptivePolicyManager,
  InvitationManager,
} from "../managers/mod.ts";
import { AccountTool } from "./account/account.tool.ts";
import { DomainAdminTool } from "./domain-admin/domain-admin.tool.ts";
import { ReceptivePolicyTool } from "./receptive-policy/receptive-policy.tool.ts";
import { InvitationTool } from "./invitations/invitations.tool.ts";

export interface Tool {
  register(server: McpServer, auth: AuthInfo): void;
}

export function initTools(managers: {
  accounts: AccountManager;
  domainIdentity: DomainIdentityManager;
  receptivePolicy: ReceptivePolicyManager;
  invitations: InvitationManager;
}): Tool[] {
  return [
    new AccountTool(managers.accounts),
    new DomainAdminTool(managers.accounts, managers.domainIdentity),
    new ReceptivePolicyTool(managers.receptivePolicy),
    new InvitationTool(managers.invitations, managers.accounts, managers.domainIdentity),
  ];
}
