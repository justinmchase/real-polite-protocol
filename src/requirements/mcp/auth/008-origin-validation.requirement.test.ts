import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:mcp-auth-008 - MCP endpoint validates Origin header",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("rejects malformed origin header", async () => {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "not-a-valid-origin",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 400);
        const body = await response.json();
        assertEquals(body.code, "E_INVALID_ORIGIN");
      });

      await t.step("rejects mismatched origin header", async () => {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://evil.example",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 400);
        const body = await response.json();
        assertEquals(body.code, "E_INVALID_ORIGIN");
      });

      await t.step(
        "accepts matching origin header and continues auth processing",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: baseUrl,
            },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const body = await response.json();
          assertEquals(body.code, "E_MISSING_HEADER");
        },
      );

      await t.step(
        "Origin validation fires before any tool handler executes",
        async () => {
          // Even with a valid bearer token, a disallowed Origin must be rejected
          // before the MCP framework dispatches to a tool handler. We verify
          // this by observing the 400 origin error rather than any tool output.
          await withAuthTestContext(async ({ issueToken }) => {
            const token = await issueToken({
              oid: crypto.randomUUID(),
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const response = await fetch(`${baseUrl}/mcp`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "authorization": `Bearer ${token}`,
                "origin": "http://evil.example",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "get_domain_identity", arguments: {} },
              }),
            });

            // Must get the origin error (400), NOT a tool result (200).
            assertEquals(response.status, 400);
            const body = await response.json();
            assertEquals(
              body.code,
              "E_INVALID_ORIGIN",
              "Origin check must fire before tool dispatch",
            );
          });
        },
      );
    });
  },
});
