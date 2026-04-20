export * from "./account/mod.ts";
export * from "./domain-admin/mod.ts";
export * from "./tool-result.ts";

import type { AccountManager, DomainIdentityManager } from "../managers/mod.ts";
import { AccountTool } from "./account/account.tool.ts";
import { DomainAdminTool } from "./domain-admin/domain-admin.tool.ts";

export interface Tool {
  register(server: unknown, auth: unknown): void;
}

export function initTools(managers: {
  accounts: AccountManager;
  domainIdentity: DomainIdentityManager;
}): Tool[] {
  return [
    new AccountTool(managers.accounts),
    new DomainAdminTool(managers.accounts, managers.domainIdentity),
  ];
}
