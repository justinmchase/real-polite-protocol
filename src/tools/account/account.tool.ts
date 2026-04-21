import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import { toolResult, withToolErrorHandling } from "../tool-result.ts";

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
  user_updated_at: z.string().optional().describe(
    "ISO 8601 timestamp of the last user metadata refresh",
  ),
  admin_updated_at: z.string().optional().describe(
    "ISO 8601 timestamp of the last admin metadata update",
  ),
  updated_at: z.string().describe("ISO 8601 timestamp of last update"),
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

    const setUserVerifiedMetadata = withToolErrorHandling(async () => {
      const record = await this.accountManager.setVerifiedMetadataFromToken(
        auth,
      );
      return toolResult(record);
    });

    server.registerTool(
      "set_user_verified_metadata",
      {
        description:
          "Refresh your user-sourced verified metadata record from your current token claims (name, email, preferred_username, ctry). No arguments required — the token is the source of truth.",
        inputSchema: {},
        outputSchema: VerifiedMetadataOutputSchema,
      },
      setUserVerifiedMetadata,
    );

    server.registerTool(
      "set_verified_metadata",
      {
        description:
          "Deprecated compatibility alias for set_user_verified_metadata.",
        inputSchema: {},
        outputSchema: VerifiedMetadataOutputSchema,
      },
      setUserVerifiedMetadata,
    );
  }
}
