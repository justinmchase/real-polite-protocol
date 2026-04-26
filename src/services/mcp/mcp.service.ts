import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "../../context.ts";
import type { Tool } from "../../tools/mod.ts";

export class McpService {
  private constructor() {}

  static create(): McpService {
    return new McpService();
  }

  async handleRequest(
    request: Request,
    tools: Tool[],
    auth: AuthInfo,
  ): Promise<Response> {
    const server = new McpServer({
      name: "rpp",
      version: "0.1.0",
    });

    for (const tool of tools) {
      try {
        tool.register(server, auth);
      } catch (e) {
        console.error(
          `[MCP] Failed to register tool ${tool.constructor.name}:`,
          e,
        );
      }
    }

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
