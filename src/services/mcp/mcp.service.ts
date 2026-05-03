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
 * GET requests are answered with `405 Method Not Allowed` per the MCP
 * Streamable HTTP transport spec, which defines 405 as the protocol-level
 * signal that the server does not offer an SSE stream — i.e. it does not
 * send server-initiated requests or notifications. This is the correct way
 * to advertise "no server push" to a compliant client.
 *
 * https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#listening-for-messages-from-the-server
 *
 * Note: some MCP clients (e.g. VS Code as of 2026-05) tight-loop on 405
 * instead of honoring it. That is a client bug; the server's response is
 * spec-correct.
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
    // GET opens the optional SSE server-push channel. We don't support it
    // (stateless, no server-initiated requests), so signal that per spec.
    if (request.method === "GET") {
      return new Response(null, {
        status: 405,
        headers: { "Allow": "POST" },
      });
    }

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
