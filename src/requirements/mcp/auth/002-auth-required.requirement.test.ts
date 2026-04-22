import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-002 - MCP endpoint requires bearer token authentication",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("server starts and becomes healthy", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });

      await t.step(
        "rejects requests with missing Authorization header",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          assertExists(response.headers.get("WWW-Authenticate"));

          const body = await response.json();
          assertEquals(body.ok, false);
          assertEquals(body.code, "E_MISSING_HEADER");
        },
      );

      await t.step(
        "rejects requests with non-bearer Authorization format",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": "Basic abc123",
            },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          assertExists(response.headers.get("WWW-Authenticate"));

          const body = await response.json();
          assertEquals(body.ok, false);
          assertEquals(body.code, "E_INVALID_FORMAT");
        },
      );

      await t.step("rejects requests with invalid bearer tokens", async () => {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": "Bearer not-a-jwt",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 401);
        assertExists(response.headers.get("WWW-Authenticate"));

        const body = await response.json();
        assertEquals(body.ok, false);
        assertEquals(body.code, "E_INVALID_TOKEN_FORMAT");
      });
    });
  },
});
