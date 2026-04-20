import type { AuthInfo } from "../../context.ts";
import type { Account, UserVerifiedMetadataRecord, VerifiableUser } from "../../models/mod.ts";
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
      allowed_tool_groups: isDomainAdmin
        ? ["listener", "domain"]
        : ["listener"],
    };
  }

  isDomainAdmin(roles: string[]): boolean {
    return roles.includes(DOMAIN_ADMIN_ROLE);
  }

  async setVerifiedMetadataFromToken(
    auth: Pick<
      AuthInfo,
      "oid" | "name" | "email" | "preferred_username" | "ctry"
    >,
  ): Promise<UserVerifiedMetadataRecord> {
    const existing = await this.accounts.getVerifiedMetadata(auth.oid);
    const currentFields = existing?.verified_fields ?? {};
    const updates: Record<string, string> = {};
    if (auth.name) updates.name = auth.name;
    if (auth.email) updates.email = auth.email;
    if (auth.preferred_username) {
      updates.preferred_username = auth.preferred_username;
    }
    if (auth.ctry) updates.ctry = auth.ctry;
    return await this.accounts.setVerifiedMetadata(auth.oid, {
      ...currentFields,
      ...updates,
    });
  }

  async getUserVerifiedMetadata(
    oid: string,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    return await this.accounts.getVerifiedMetadata(oid);
  }

  async listVerifiableUsers(): Promise<VerifiableUser[]> {
    const records = await this.accounts.listVerifiedMetadata();
    return records
      .map((record) => ({
        oid: record.oid,
        verified_fields: record.verified_fields,
      }))
      .sort((a, b) => a.oid.localeCompare(b.oid));
  }
}
