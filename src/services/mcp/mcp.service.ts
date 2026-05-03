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
 * GET requests (SSE channel open) are handled independently — NOT via the
 * MCP transport — to avoid the transport's server.close() tearing down the
 * stream body before the client can read it. A minimal SSE response is
 * returned that contains only a `retry:` directive and then closes. This:
 *   - Returns 200 (not 405) so the client does not enter a tight retry loop.
 *   - Instructs the client to wait SSE_RETRY_MS before reconnecting.
 *   - Closes the connection immediately so no Deno Deploy isolate is kept alive.
 *
 * The `retry:` field is a standard SSE mechanism (EventSource spec §9.2.5).
 * VS Code and other MCP SSE clients honor it.
 */

/** How long (ms) SSE clients should wait before reconnecting after GET /mcp closes. */
const SSE_RETRY_MS = 60_000;
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
    // GET opens the SSE server-push channel. For a stateless server that
    // never initiates requests, hold the channel open with periodic keepalive
    // comments so clients do not immediately reconnect.
    if (request.method === "GET") {
      return this.openSseKeepaliveChannel();
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

  private openSseKeepaliveChannel(): Response {
    // Emit a `retry:` directive then close immediately. The client will
    // reconnect after SSE_RETRY_MS — no persistent connection, no isolate held.
    const body = `retry: ${SSE_RETRY_MS}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
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
