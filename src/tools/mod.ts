import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "../context.ts";
import type { Managers } from "../managers/mod.ts";
import type { ConfigService } from "../services/config/config.service.ts";
import { AccountTool } from "./account/mod.ts";
import { ContactTool } from "./contacts/mod.ts";
import { DomainAdminTool } from "./domain-admin/mod.ts";
import { ReceptivePolicyTool } from "./receptive-policy/mod.ts";
import { InvitationTool } from "./invitations/mod.ts";
import { MessageTool } from "./messages/mod.ts";

export * from "./tool-result.ts";

/** Common interface every MCP tool registration class implements. */
export interface Tool {
  register(server: McpServer, auth: AuthInfo): void;
}

export function initTools(
  managers: Managers,
  config: ConfigService,
): Tool[] {
  return [
    new AccountTool(managers.accounts),
    new ContactTool(managers.contacts),
    new DomainAdminTool(managers.accounts, managers.domainIdentity),
    new ReceptivePolicyTool(managers.receptivePolicy, config),
    new InvitationTool(
      managers.invitations,
      managers.accounts,
      managers.contacts,
      managers.receptivePolicy,
      config,
    ),
    new MessageTool(
      managers.messages,
      managers.sentMessages,
      managers.contacts,
      config,
    ),
  ];
}
