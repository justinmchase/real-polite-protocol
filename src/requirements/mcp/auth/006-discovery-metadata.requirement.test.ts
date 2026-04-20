import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-006 - OAuth discovery metadata is published for MCP authentication",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step("serves protected resource metadata", async () => {
        const response = await fetch(
          "http://localhost:8000/.well-known/oauth-protected-resource",
        );
        assertEquals(response.status, 200);

        const body = await response.json();
        assertEquals(body.resource, "http://localhost:8000/mcp");
        assertEquals(Array.isArray(body.authorization_servers), true);
        assertEquals(
          body.authorization_servers.includes("http://localhost:8000"),
          true,
        );
        assertEquals(body.bearer_methods_supported.includes("header"), true);
      });

      await t.step("serves authorization server metadata", async () => {
        const response = await fetch(
          "http://localhost:8000/.well-known/oauth-authorization-server",
        );
        assertEquals(response.status, 200);

        const body = await response.json();
        assertEquals(body.issuer, "http://localhost:8000");
        assertEquals(
          body.authorization_endpoint,
          "http://localhost:8000/authorize",
        );
        assertEquals(body.token_endpoint, "http://localhost:8000/token");
        assertEquals(body.resource, "http://localhost:8000/mcp");
        assertEquals(body.response_types_supported.includes("code"), true);
        assertEquals(
          body.code_challenge_methods_supported.includes("S256"),
          true,
        );
      });
    });
  },
});
