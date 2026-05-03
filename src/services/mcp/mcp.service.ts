import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "../../context.ts";
import type { Tool } from "../../tools/mod.ts";

/**
 * MCP transport service.
 *
 * Every request is processed as a stateless one-shot: a fresh `McpServer`
 * and transport are created per request, the response is returned, and both
 * are torn down. No session state is maintained between requests.
 *
 * Stateless mode is required for compatibility with Deno Deploy (and any
 * other serverless edge platform):
 *   - No in-process session map → isolates can go idle between tool calls.
 *   - No `Deno.Kv.watch` loop → isolates are not kept alive indefinitely.
 *   - No `Mcp-Session-Id` header returned → clients never enter a reconnect
 *     cascade caused by stale session IDs across isolate evictions.
 *
 * GET requests (SSE channel open) are passed through to the transport, which
 * returns 200 text/event-stream. This prevents SSE clients (e.g. VS Code)
 * from entering a tight 1/s retry loop that would occur if the server
 * returned 405.
 */
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
    const server = this.buildServer(tools, auth);
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

  private buildServer(tools: Tool[], auth: AuthInfo): McpServer {
    const server = new McpServer({ name: "rpp", version: "0.1.0" });

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

    return server;
  }
}
