import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";

export class AccountTool {
  constructor(
    private readonly accountManager: AccountManager,
    private readonly auth: AuthInfo,
  ) {}

  register(server: McpServer): void {
    server.tool(
      "get_permissions",
      "Return current account permission levels.",
      async () => {
        const permissions = await this.accountManager.getPermissions(this.auth);
        return {
          content: [{ type: "text", text: JSON.stringify(permissions) }],
        };
      },
    );
  }
}
