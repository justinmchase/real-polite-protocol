import type { AuthInfo } from "../../context.ts";
import type {
  Account,
  UserVerifiedMetadataRecord,
  VerifiableUser,
} from "../../models/mod.ts";
import type { AccountRepository } from "../../repositories/mod.ts";
import type { PaginatedResult, PaginationInput } from "../../utils/mod.ts";
import { VerifiedMetadataValueTooLongError } from "../../tools/domain-admin/domain-admin.error.ts";

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

  private extractUserVerifiedFields(
    auth: Pick<
      AuthInfo,
      "name" | "email" | "preferred_username" | "ctry"
    >,
  ): Record<string, string> {
    const updates: Record<string, string> = {};
    if (auth.name) updates.name = auth.name;
    if (auth.email) updates.email = auth.email;
    if (auth.preferred_username) {
      updates.preferred_username = auth.preferred_username;
    }
    if (auth.ctry) updates.ctry = auth.ctry;
    return updates;
  }

  private assertAdminFieldValueLengths(
    verifiedFields: Record<string, string>,
  ): void {
    for (const [field, value] of Object.entries(verifiedFields)) {
      if (value.length > 512) {
        throw new VerifiedMetadataValueTooLongError(field, 512);
      }
    }
  }

  async ensureAccount(
    auth: Pick<
      AuthInfo,
      "oid" | "name" | "email" | "preferred_username" | "ctry"
    >,
  ): Promise<Account> {
    let account = await this.accounts.ensureByOid(auth.oid);
    // Lazy migration: assign domain_id to legacy accounts that lack it.
    if (!account.domain_id) {
      account = await this.accounts.assignDomainId(auth.oid);
    }
    const existingMetadata = await this.accounts.getVerifiedMetadata(auth.oid);
    if (!existingMetadata) {
      await this.accounts.setUserVerifiedMetadata(
        auth.oid,
        this.extractUserVerifiedFields(auth),
      );
      // Seed domain_id as an immutable server-assigned claim.
      await this.accounts.setImmutableFields(auth.oid, {
        domain_id: account.domain_id,
      });
    } else if (!existingMetadata.immutable_fields["domain_id"]) {
      // Lazy migration: seed domain_id into immutable_fields.
      await this.accounts.setImmutableFields(auth.oid, {
        domain_id: account.domain_id,
      });
    }
    return account;
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
    return await this.accounts.setUserVerifiedMetadata(
      auth.oid,
      this.extractUserVerifiedFields(auth),
    );
  }

  async getUserVerifiedMetadata(
    oid: string,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    return await this.accounts.getVerifiedMetadata(oid);
  }

  async setUserVerifiedMetadataByAdmin(
    oid: string,
    verifiedFields: Record<string, string>,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    const account = await this.accounts.findByOid(oid);
    if (!account) {
      return undefined;
    }
    this.assertAdminFieldValueLengths(verifiedFields);
    const existing = await this.accounts.getVerifiedMetadata(oid);
    return await this.accounts.setAdminVerifiedMetadata(oid, {
      ...(existing?.admin_verified_fields ?? {}),
      ...verifiedFields,
    });
  }

  async removeAdminVerifiedMetadata(
    oid: string,
    field: string,
  ): Promise<UserVerifiedMetadataRecord | undefined> {
    const account = await this.accounts.findByOid(oid);
    if (!account) {
      return undefined;
    }

    const existing = await this.accounts.getVerifiedMetadata(oid);
    const adminVerifiedFields = { ...(existing?.admin_verified_fields ?? {}) };
    delete adminVerifiedFields[field];

    return await this.accounts.setAdminVerifiedMetadata(oid, adminVerifiedFields);
  }

  async listVerifiableUsers(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<VerifiableUser>> {
    const page = await this.accounts.listVerifiedMetadataPage(pagination);
    return {
      items: page.items.map((record) => ({
        oid: record.oid,
        verified_fields: record.verified_fields,
      })),
      next_resume_token: page.next_resume_token,
    };
  }
}
