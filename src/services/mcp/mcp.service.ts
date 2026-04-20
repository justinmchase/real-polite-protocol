import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import { AccountTool } from "../../tools/mod.ts";

export class McpService {
  private constructor() {}

  static create(): McpService {
    return new McpService();
  }

  async handleRequest(
    request: Request,
    auth: AuthInfo,
    accountManager: AccountManager,
  ): Promise<Response> {
    const server = new McpServer({
      name: "rpp-api",
      version: "0.1.0",
    });

    server.tool(
      "hello_world",
      "Return a hello world message.",
      () => ({
        content: [{ type: "text", text: "Hello, world!" }],
      }),
    );

    new AccountTool(accountManager, auth).register(server);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  }
}
