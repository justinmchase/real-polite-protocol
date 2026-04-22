import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-007 - Unauthorized responses include OAuth challenge metadata",
  fn: async () => {
    await withStartedServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      assertEquals(response.status, 401);
      const challenge = response.headers.get("WWW-Authenticate");
      assertExists(challenge);
      assertEquals(
        challenge.includes(
          `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        ),
        true,
      );
      assertEquals(
        challenge.includes(
          `authorization_uri="${baseUrl}/authorize"`,
        ),
        true,
      );
      assertEquals(challenge.includes("rpp.tools.read"), true);
      await response.text();
    });
  },
});
