import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import { toolResult } from "../tool-result.ts";

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

export class AccountTool {
  constructor(private readonly accountManager: AccountManager) {}

  register(server: McpServer, auth: AuthInfo): void {
    server.registerTool(
      "get_permissions",
      {
        description: "Return current account permission levels.",
        outputSchema: PermissionsOutputSchema,
      },
      async () => {
        const permissions = await this.accountManager.getPermissions(auth);
        return toolResult(permissions);
      },
    );
  }
}
