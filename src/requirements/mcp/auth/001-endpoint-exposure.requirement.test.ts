import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";

Deno.test({
  name: "req:mcp-auth-001 - Server exposes MCP endpoint for listener workflows",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("server starts and becomes healthy", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });

      await t.step(
        "mcp endpoint is exposed and challenges unauthenticated requests",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          assertExists(response.headers.get("WWW-Authenticate"));

          const body = await response.json();
          assertEquals(body.ok, false);
        },
      );
    });
  },
});
