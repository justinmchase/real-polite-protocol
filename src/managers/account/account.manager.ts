import type { AuthInfo } from "../../context.ts";
import type { Account } from "../../models/mod.ts";
import type { AccountRepository } from "../../repositories/mod.ts";

const DOMAIN_ADMIN_ROLE = "domain.admin";

export interface PermissionLevels {
  account_id: string;
  oid: string;
  roles: string[];
  is_domain_admin: boolean;
  allowed_tool_groups: string[];
}

export class AccountManager {
  constructor(private readonly accounts: AccountRepository) {}

  async ensureAccount(auth: Pick<AuthInfo, "oid">): Promise<Account> {
    return await this.accounts.ensureByOid(auth.oid);
  }

  async getPermissions(auth: AuthInfo): Promise<PermissionLevels> {
    const account = await this.ensureAccount(auth);
    const isDomainAdmin = this.isDomainAdmin(auth.roles);
    return {
      account_id: account.id,
      oid: account.oid,
      roles: auth.roles,
      is_domain_admin: isDomainAdmin,
      allowed_tool_groups: isDomainAdmin ? ["listener", "domain"] : ["listener"],
    };
  }

  isDomainAdmin(roles: string[]): boolean {
    return roles.includes(DOMAIN_ADMIN_ROLE);
  }
}
