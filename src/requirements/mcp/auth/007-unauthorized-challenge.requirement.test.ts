import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";

Deno.test({
  name:
    "req:mcp-auth-007 - Unauthorized responses include OAuth challenge metadata",
  fn: async (t) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step(
        "401 response includes WWW-Authenticate header with resource metadata pointer",
        async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const challenge = response.headers.get("WWW-Authenticate");
          assertExists(challenge, "WWW-Authenticate header must be present");
          assertEquals(
            challenge.includes(
              `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
            ),
            true,
            "WWW-Authenticate must include resource_metadata pointer",
          );
          assertEquals(
            challenge.includes(
              `authorization_uri="${baseUrl}/authorize"`,
            ),
            true,
            "WWW-Authenticate must include authorization_uri",
          );
          assertEquals(
            challenge.includes("rpp.tools.read"),
            true,
            "WWW-Authenticate must include required scope",
          );
          await response.text();
        },
      );
    });
  },
});
