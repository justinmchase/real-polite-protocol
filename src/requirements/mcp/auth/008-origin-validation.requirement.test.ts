import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-008 - MCP endpoint validates Origin header",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step("rejects malformed origin header", async () => {
        const response = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "not-a-valid-origin",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 400);
        const body = await response.json();
        assertEquals(body.code, "INVALID_ORIGIN");
      });

      await t.step("rejects mismatched origin header", async () => {
        const response = await fetch("http://localhost:8000/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://evil.example",
          },
          body: JSON.stringify({}),
        });

        assertEquals(response.status, 400);
        const body = await response.json();
        assertEquals(body.code, "INVALID_ORIGIN");
      });

      await t.step(
        "accepts matching origin header and continues auth processing",
        async () => {
          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:8000",
            },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const body = await response.json();
          assertEquals(body.code, "MISSING_HEADER");
        },
      );
    });
  },
});
