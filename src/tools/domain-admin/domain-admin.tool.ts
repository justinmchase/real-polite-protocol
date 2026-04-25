import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import type { DomainIdentityManager } from "../../managers/mod.ts";
import {
  AccountNotFoundError,
  AdminVerifiedMetadataFieldNotFoundError,
  UserVerifiedMetadataNotFoundError,
} from "./domain-admin.error.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

const PaginationInputSchema = {
  page_size: z.number().int().min(1).max(200).optional().describe(
    "Maximum number of items to return",
  ),
  resume_token: z.string().optional().describe(
    "Opaque token from the previous page",
  ),
};

const DomainIdentityOutputSchema = {
  domain: z.string().describe("The domain name"),
  display_name: z.string().describe("Human-readable display name"),
  domain_type: z.string().optional().describe("Type of domain"),
  parent_domain: z.string().optional().describe("Parent domain if subdomain"),
  categories_offered: z.array(z.string()).optional().describe(
    "Content categories offered",
  ),
  rpp_since: z.coerce.date().optional().describe(
    "ISO 8601 date when RPP support began",
  ),
  contact_policy_url: z.string().url().optional().describe(
    "URL to the domain's contact policy",
  ),
};

const VerificationKeyOutputSchema = {
  key_id: z.string().describe("Identifier for the active verification key"),
  public_key: z.object({
    algorithm: z.literal("Ed25519").describe("Public key algorithm"),
    key: z.string().describe(
      "Base64-encoded public key in SPKI format",
    ),
  }).describe("Current public verification key metadata"),
};

const HistoricalVerificationKeySchema = {
  key_id: z.string().describe("Identifier for an archived verification key"),
  public_key: z.object({
    algorithm: z.literal("Ed25519").describe("Public key algorithm"),
    key: z.string().describe(
      "Base64-encoded public key in SPKI format",
    ),
  }).describe("Archived public verification key metadata"),
  archived_at: z.coerce.date().describe(
    "ISO 8601 timestamp when the key was archived",
  ),
};

const HistoricalKeysOutputSchema = {
  keys: z.array(z.object(HistoricalVerificationKeySchema)).describe(
    "Archived verification keys",
  ),
  next_resume_token: z.string().optional().describe(
    "Opaque token to fetch the next page",
  ),
};

const DeleteHistoricalKeyInputSchema = {
  key_id: z.string().describe("Identifier of the historical key to delete"),
};

const DeleteHistoricalKeyOutputSchema = {
  key_id: z.string().describe("Identifier of the deleted historical key"),
  deleted: z.boolean().describe("Whether deletion was applied"),
};

const VerifiableUsersOutputSchema = {
  users: z.array(z.object({
    oid: z.string().describe("User object identifier"),
    verified_fields: z.record(z.string(), z.string()).describe(
      "Effective verified metadata fields keyed by field name",
    ),
  })).describe("Users with verifiable metadata"),
  next_resume_token: z.string().optional().describe(
    "Opaque token to fetch the next page",
  ),
};

const ListHistoricalKeysInputSchema = {
  ...PaginationInputSchema,
};

const ListVerifiableUsersInputSchema = {
  ...PaginationInputSchema,
};

const GetUserVerifiedMetadataInputSchema = {
  oid: z.string().describe("Target user object identifier"),
};

const UserVerifiedMetadataOutputSchema = {
  oid: z.string().describe("User object identifier"),
  immutable_fields: z.record(z.string(), z.string()).describe(
    "Server-assigned immutable metadata fields (e.g. domain_id). Cannot be modified by any tool.",
  ),
  user_verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields derived from the user's token",
  ),
  admin_verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields supplied by domain administrators",
  ),
  verified_fields: z.record(z.string(), z.string()).describe(
    "Effective verified metadata fields keyed by field name",
  ),
  user_updated_at: z.coerce.date().optional().describe(
    "ISO 8601 timestamp of the last user metadata refresh",
  ),
  admin_updated_at: z.coerce.date().optional().describe(
    "ISO 8601 timestamp of the last admin metadata update",
  ),
  updated_at: z.coerce.date().describe(
    "ISO 8601 timestamp of the latest verification update",
  ),
};

const SetUserVerifiedMetadataInputSchema = {
  oid: z.string().describe("Target user object identifier"),
  verified_fields: z.record(z.string(), z.string()).describe(
    "Admin-supplied verified metadata fields keyed by field name; each value must be 512 characters or fewer",
  ),
};

const RemoveAdminVerifiedMetadataInputSchema = {
  oid: z.string().describe("Target user object identifier"),
  field: z.string().describe("Admin verified metadata field to remove"),
};

const ContactPolicyUrlOutputSchema = {
  contact_policy_url: z.url().optional().describe(
    "Configured domain contact policy URL",
  ),
};

const SetContactPolicyUrlInputSchema = {
  contact_policy_url: z.url().describe(
    "Updated domain contact policy URL",
  ),
};

const UpdateDomainIdentityInputSchema = {
  display_name: z.string().optional().describe(
    "Human-readable display name for the domain",
  ),
  domain_type: z.string().optional().describe(
    "Type of domain (e.g. 'podcast', 'newsletter')",
  ),
  parent_domain: z.string().optional().describe(
    "Parent domain if this is a subdomain",
  ),
  categories_offered: z.array(z.string()).optional().describe(
    "Content categories offered",
  ),
  rpp_since: z.string().optional().describe(
    "ISO 8601 date when RPP support began",
  ),
  contact_policy_url: z.string().optional().describe(
    "URL to the domain's contact policy",
  ),
};

type UpdateDomainIdentityArgs = z.infer<
  z.ZodObject<typeof UpdateDomainIdentityInputSchema>
>;

type DeleteHistoricalKeyArgs = z.infer<
  z.ZodObject<typeof DeleteHistoricalKeyInputSchema>
>;

type ListHistoricalKeysArgs = z.infer<
  z.ZodObject<typeof ListHistoricalKeysInputSchema>
>;

type ListVerifiableUsersArgs = z.infer<
  z.ZodObject<typeof ListVerifiableUsersInputSchema>
>;

type GetUserVerifiedMetadataArgs = z.infer<
  z.ZodObject<typeof GetUserVerifiedMetadataInputSchema>
>;

type SetUserVerifiedMetadataArgs = z.infer<
  z.ZodObject<typeof SetUserVerifiedMetadataInputSchema>
>;

type RemoveAdminVerifiedMetadataArgs = z.infer<
  z.ZodObject<typeof RemoveAdminVerifiedMetadataInputSchema>
>;

type SetContactPolicyUrlArgs = z.infer<
  z.ZodObject<typeof SetContactPolicyUrlInputSchema>
>;

export class DomainAdminTool {
  constructor(
    private readonly accountManager: AccountManager,
    private readonly domainIdentityManager: DomainIdentityManager,
  ) {}

  register(server: McpServer, auth: AuthInfo): void {
    if (!this.accountManager.isDomainAdmin(auth.roles)) {
      return;
    }

    server.registerTool(
      "get_domain_identity",
      {
        description:
          "Retrieve the current domain identity as published by the server.",
        outputSchema: DomainIdentityOutputSchema,
      },
      withToolErrorHandling(async () => {
        const identity = await this.domainIdentityManager.getDomainIdentity();
        return toolResult(identity);
      }),
    );

    server.registerTool(
      "update_domain_identity",
      {
        description: "Update mutable domain identity fields.",
        inputSchema: UpdateDomainIdentityInputSchema,
        outputSchema: DomainIdentityOutputSchema,
      },
      withToolErrorHandling(async (params: UpdateDomainIdentityArgs) => {
        const identity = await this.domainIdentityManager.updateDomainIdentity(
          params,
        );
        return toolResult(identity);
      }),
    );

    server.registerTool(
      "get_verification_key",
      {
        description:
          "Retrieve the active public verification key and key identifier.",
        outputSchema: VerificationKeyOutputSchema,
      },
      withToolErrorHandling(async () => {
        const key = await this.domainIdentityManager.getVerificationKey();
        return toolResult(key);
      }),
    );

    server.registerTool(
      "rotate_verification_key",
      {
        description:
          "Generate a new Ed25519 keypair for domain-verified invitations. Archives the previous active key.",
        outputSchema: VerificationKeyOutputSchema,
      },
      withToolErrorHandling(async () => {
        const key = await this.domainIdentityManager.rotateVerificationKey();
        return toolResult(key);
      }),
    );

    server.registerTool(
      "list_historical_keys",
      {
        description:
          "List archived verification keys with key_id and archived_at metadata.",
        inputSchema: ListHistoricalKeysInputSchema,
        outputSchema: HistoricalKeysOutputSchema,
      },
      withToolErrorHandling(async (params: ListHistoricalKeysArgs) => {
        const page = await this.domainIdentityManager
          .listHistoricalVerificationKeys({
            page_size: params.page_size,
            resume_token: params.resume_token,
          });
        return toolResult({
          keys: page.items,
          next_resume_token: page.next_resume_token,
        });
      }),
    );

    server.registerTool(
      "delete_historical_key",
      {
        description:
          "Remove an archived verification key by key_id. Prior attestations using that key become unverifiable.",
        inputSchema: DeleteHistoricalKeyInputSchema,
        outputSchema: DeleteHistoricalKeyOutputSchema,
      },
      withToolErrorHandling(async (params: DeleteHistoricalKeyArgs) => {
        const result = await this.domainIdentityManager
          .deleteHistoricalVerificationKey(params.key_id);
        return toolResult(result);
      }),
    );

    server.registerTool(
      "list_verifiable_users",
      {
        description:
          "List users whose metadata the server can verify, along with their verifiable fields.",
        inputSchema: ListVerifiableUsersInputSchema,
        outputSchema: VerifiableUsersOutputSchema,
      },
      withToolErrorHandling(async (params: ListVerifiableUsersArgs) => {
        const page = await this.accountManager.listVerifiableUsers({
          page_size: params.page_size,
          resume_token: params.resume_token,
        });
        return toolResult({
          users: page.items,
          next_resume_token: page.next_resume_token,
        });
      }),
    );

    server.registerTool(
      "get_user_verified_metadata",
      {
        description: "Retrieve verified metadata for a specific user by oid.",
        inputSchema: GetUserVerifiedMetadataInputSchema,
        outputSchema: UserVerifiedMetadataOutputSchema,
      },
      withToolErrorHandling(async (params: GetUserVerifiedMetadataArgs) => {
        const metadata = await this.accountManager.getUserVerifiedMetadata(
          params.oid,
        );
        if (!metadata) {
          throw new UserVerifiedMetadataNotFoundError(params.oid);
        }
        return toolResult(metadata);
      }),
    );

    server.registerTool(
      "set_admin_verified_metadata",
      {
        description:
          "Create or update admin-supplied verified metadata fields for a specific registered user.",
        inputSchema: SetUserVerifiedMetadataInputSchema,
        outputSchema: UserVerifiedMetadataOutputSchema,
      },
      withToolErrorHandling(async (params: SetUserVerifiedMetadataArgs) => {
        const metadata = await this.accountManager
          .setUserVerifiedMetadataByAdmin(params.oid, params.verified_fields);
        if (!metadata) {
          throw new AccountNotFoundError(params.oid);
        }
        return toolResult(metadata);
      }),
    );

    server.registerTool(
      "remove_admin_verified_metadata",
      {
        description:
          "Remove one admin-verified metadata field for a specific registered user.",
        inputSchema: RemoveAdminVerifiedMetadataInputSchema,
        outputSchema: UserVerifiedMetadataOutputSchema,
      },
      withToolErrorHandling(async (params: RemoveAdminVerifiedMetadataArgs) => {
        const existing = await this.accountManager.getUserVerifiedMetadata(
          params.oid,
        );
        if (!existing) {
          throw new UserVerifiedMetadataNotFoundError(params.oid);
        }
        if (!(params.field in existing.admin_verified_fields)) {
          throw new AdminVerifiedMetadataFieldNotFoundError(
            params.oid,
            params.field,
          );
        }

        const metadata = await this.accountManager.removeAdminVerifiedMetadata(
          params.oid,
          params.field,
        );
        if (!metadata) {
          throw new AccountNotFoundError(params.oid);
        }
        return toolResult(metadata);
      }),
    );

    server.registerTool(
      "get_contact_policy_url",
      {
        description:
          "Retrieve the current contact_policy_url from domain identity.",
        outputSchema: ContactPolicyUrlOutputSchema,
      },
      withToolErrorHandling(async () => {
        const result = await this.domainIdentityManager.getContactPolicyUrl();
        return toolResult(result);
      }),
    );

    server.registerTool(
      "set_contact_policy_url",
      {
        description: "Set or update the contact_policy_url.",
        inputSchema: SetContactPolicyUrlInputSchema,
        outputSchema: ContactPolicyUrlOutputSchema,
      },
      withToolErrorHandling(async (params: SetContactPolicyUrlArgs) => {
        const result = await this.domainIdentityManager.setContactPolicyUrl(
          params.contact_policy_url,
        );
        return toolResult(result);
      }),
    );
  }
}
