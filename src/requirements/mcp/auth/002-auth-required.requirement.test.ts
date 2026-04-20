import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-002 - MCP endpoint requires bearer token authentication",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step("server starts and becomes healthy", async () => {
        const res = await fetch("http://localhost:8000/health");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.ok, true);
      });

      await t.step(
        "rejects requests with missing Authorization header",
        async () => {
          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          assertExists(response.headers.get("WWW-Authenticate"));

          const body = await response.json();
          assertEquals(body.ok, false);
          assertEquals(body.code, "MISSING_HEADER");
        },
      );

      await t.step(
        "rejects requests with non-bearer Authorization format",
        async () => {
          const response = await fetch("http://localhost:8000/mcp", {
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
          assertEquals(body.code, "INVALID_FORMAT");
        },
      );

      await t.step("rejects requests with invalid bearer tokens", async () => {
        const response = await fetch("http://localhost:8000/mcp", {
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
        assertEquals(body.code, "INVALID_TOKEN_FORMAT");
      });
    });
  },
});
