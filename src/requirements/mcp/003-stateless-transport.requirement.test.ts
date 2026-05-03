import { assert, assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

async function postMcp(
  baseUrl: string,
  token: string,
  body: unknown,
): Promise<
  { status: number; headers: Headers; body: Record<string, unknown> }
> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json() as Record<string, unknown>;
  return { status: response.status, headers: response.headers, body: json };
}

Deno.test({
  name: "req:mcp-003 - MCP endpoint operates in stateless (session-less) mode",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl }) => {
        const token = await issueToken({
          oid: crypto.randomUUID(),
          roles: ["domain.admin"],
          scope: requiredScopes.join(" "),
          name: "Test User",
        });

        await t.step(
          "initialize response does not include Mcp-Session-Id header",
          async () => {
            const { status, headers } = await postMcp(baseUrl, token, {
              jsonrpc: "2.0",
              id: "init-1",
              method: "initialize",
              params: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" },
              },
            });
            assertEquals(status, 200);
            assertEquals(
              headers.get("mcp-session-id"),
              null,
              "server MUST NOT assign a session ID in stateless mode",
            );
          },
        );

        await t.step(
          "tools/list succeeds without a session ID (independent stateless call)",
          async () => {
            const { status, body } = await postMcp(baseUrl, token, {
              jsonrpc: "2.0",
              id: "list-1",
              method: "tools/list",
            });
            assertEquals(status, 200);
            const result = body.result as { tools?: unknown[] } | undefined;
            assert(result, "tools/list response missing result");
            assert(
              Array.isArray(result.tools) && result.tools.length > 0,
              "tools/list must return a non-empty tools array",
            );
          },
        );

        await t.step(
          "InitializeResult capabilities do not declare resources.subscribe",
          async () => {
            const { status, body } = await postMcp(baseUrl, token, {
              jsonrpc: "2.0",
              id: "init-2",
              method: "initialize",
              params: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" },
              },
            });
            assertEquals(status, 200);
            const result = body.result as {
              capabilities?: { resources?: { subscribe?: boolean } };
            } | undefined;
            assert(result, "initialize response missing result");
            const resourcesCap = result.capabilities?.resources;
            assert(
              !resourcesCap?.subscribe,
              "server MUST NOT declare resources.subscribe capability in stateless mode",
            );
          },
        );

        await t.step(
          "GET /mcp returns 200 text/event-stream to satisfy SSE clients without retries",
          async () => {
            const response = await fetch(`${baseUrl}/mcp`, {
              method: "GET",
              headers: {
                "accept": "text/event-stream",
                "authorization": `Bearer ${token}`,
              },
            });
            const body = await response.text();
            assertEquals(
              response.status,
              200,
              "GET /mcp MUST return 200 so SSE clients do not enter a tight retry loop",
            );
            assertEquals(
              response.headers.get("content-type"),
              "text/event-stream",
              "GET /mcp MUST return Content-Type: text/event-stream",
            );
            assertEquals(
              response.headers.get("mcp-session-id"),
              null,
              "GET /mcp MUST NOT assign a session ID in stateless mode",
            );
            assert(
              body.includes("retry:"),
              "GET /mcp SSE body MUST include a retry: directive to throttle client reconnects",
            );
          },
        );
      });
    });
  },
});
