import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import type { DomainIdentityManager } from "../../managers/mod.ts";
import {
  AccountNotFoundError,
  UserVerifiedMetadataNotFoundError,
} from "./domain-admin.error.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

const DomainIdentityOutputSchema = {
  domain: z.string().describe("The domain name"),
  display_name: z.string().describe("Human-readable display name"),
  domain_type: z.string().optional().describe("Type of domain"),
  parent_domain: z.string().optional().describe("Parent domain if subdomain"),
  categories_offered: z.array(z.string()).optional().describe(
    "Content categories offered",
  ),
  rpp_since: z.iso.datetime().optional().describe(
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
  archived_at: z.iso.datetime().describe(
    "ISO 8601 timestamp when the key was archived",
  ),
};

const HistoricalKeysOutputSchema = {
  keys: z.array(z.object(HistoricalVerificationKeySchema)).describe(
    "Archived verification keys",
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
      "Verified metadata fields keyed by field name",
    ),
  })).describe("Users with verifiable metadata"),
};

const GetUserVerifiedMetadataInputSchema = {
  oid: z.string().describe("Target user object identifier"),
};

const UserVerifiedMetadataOutputSchema = {
  oid: z.string().describe("User object identifier"),
  verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields keyed by field name",
  ),
  updated_at: z.iso.datetime().describe(
    "ISO 8601 timestamp of the latest verification update",
  ),
};

const SetUserVerifiedMetadataInputSchema = {
  oid: z.string().describe("Target user object identifier"),
  verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields keyed by field name",
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

type GetUserVerifiedMetadataArgs = z.infer<
  z.ZodObject<typeof GetUserVerifiedMetadataInputSchema>
>;

type SetUserVerifiedMetadataArgs = z.infer<
  z.ZodObject<typeof SetUserVerifiedMetadataInputSchema>
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
        outputSchema: HistoricalKeysOutputSchema,
      },
      withToolErrorHandling(async () => {
        const keys = await this.domainIdentityManager
          .listHistoricalVerificationKeys();
        return toolResult({ keys });
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
        outputSchema: VerifiableUsersOutputSchema,
      },
      withToolErrorHandling(async () => {
        const users = await this.accountManager.listVerifiableUsers();
        return toolResult({ users });
      }),
    );

    server.registerTool(
      "get_user_verified_metadata",
      {
        description:
          "Retrieve verified metadata for a specific user by oid.",
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
      "set_user_verified_metadata",
      {
        description:
          "Create or update verified metadata fields for a specific registered user.",
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
  }
}
