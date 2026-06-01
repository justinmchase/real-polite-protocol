import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";
import { outputDate } from "../date-schema.ts";

const PermissionsOutputSchema = {
  account_id: z.string().describe("The account identifier"),
  oid: z.string().describe("The Azure AD object identifier"),
  roles: z.array(z.string()).describe("Assigned roles"),
  is_domain_admin: z.boolean().describe(
    "Whether the user is a domain administrator",
  ),
  allowed_tool_groups: z.array(z.string()).describe(
    "Tool groups the user may access",
  ),
};

const VerifiedMetadataOutputSchema = {
  oid: z.string().describe("User object identifier"),
  user_verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields derived from the user's token",
  ),
  admin_verified_fields: z.record(z.string(), z.string()).describe(
    "Verified metadata fields supplied by domain administrators",
  ),
  verified_fields: z.record(z.string(), z.string()).describe(
    "Effective verified metadata fields after applying admin precedence",
  ),
  user_updated_at: outputDate().optional().describe(
    "ISO 8601 timestamp of the last user metadata refresh",
  ),
  admin_updated_at: outputDate().optional().describe(
    "ISO 8601 timestamp of the last admin metadata update",
  ),
  updated_at: outputDate().describe("ISO 8601 timestamp of last update"),
};

const DisplayNameOutputSchema = {
  display_name: z.string().nullable().describe(
    "The account's display name, or null if not set",
  ),
};

export class AccountTool {
  constructor(private readonly accountManager: AccountManager) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "get_permissions",
      {
        description: "Return current account permission levels.",
        outputSchema: PermissionsOutputSchema,
      },
      withToolErrorHandling(async () => {
        const permissions = await this.accountManager.getPermissions(auth);
        return toolResult(permissions);
      }),
    );

    server.registerTool(
      "set_user_verified_metadata",
      {
        description:
          "Refresh your user-sourced verified metadata record from your current token claims (name, email, preferred_username, ctry). No arguments required — the token is the source of truth.",
        inputSchema: {},
        outputSchema: VerifiedMetadataOutputSchema,
      },
      withToolErrorHandling(async () => {
        const record = await this.accountManager.setVerifiedMetadataFromToken(
          auth,
        );
        return toolResult(record);
      }),
    );

    server.registerTool(
      "set_display_name",
      {
        description:
          "Set or clear the display name for the authenticated account. Pass null to clear.",
        inputSchema: {
          display_name: z.string().max(256).nullable().describe(
            "Display name (≤256 chars) to set, or null to clear",
          ),
        },
        outputSchema: DisplayNameOutputSchema,
      },
      withToolErrorHandling(
        async ({ display_name }: { display_name: string | null }) => {
          const result = await this.accountManager.setDisplayName(
            auth,
            display_name,
          );
          return toolResult(result);
        },
      ),
    );

    server.registerTool(
      "get_display_name",
      {
        description: "Get the display name for the authenticated account.",
        inputSchema: {},
        outputSchema: DisplayNameOutputSchema,
      },
      withToolErrorHandling(async () => {
        const result = await this.accountManager.getDisplayName(auth);
        return toolResult(result);
      }),
    );
  }
}
