import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-011 - OAuth authorization flow uses canonical resource indicator",
  fn: async (t) => {
    await withStartedServer(async () => {
      await t.step(
        "publishes canonical resource URI in protected resource metadata",
        async () => {
          const response = await fetch(
            "http://localhost:8000/.well-known/oauth-protected-resource",
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.resource, "http://localhost:8000/mcp");
        },
      );

      await t.step(
        "publishes matching canonical resource URI in authorization server metadata",
        async () => {
          const response = await fetch(
            "http://localhost:8000/.well-known/oauth-authorization-server",
          );
          assertEquals(response.status, 200);
          const body = await response.json();
          assertEquals(body.resource, "http://localhost:8000/mcp");
        },
      );

      await t.step(
        "includes canonical resource metadata pointer in unauthorized challenge flow",
        async () => {
          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const challenge = response.headers.get("WWW-Authenticate");
          assertExists(challenge);
          assertEquals(
            challenge.includes(
              'resource_metadata="http://localhost:8000/.well-known/oauth-protected-resource"',
            ),
            true,
          );
          await response.text();
        },
      );

      await t.step(
        "accepts canonical resource parameter on authorization endpoint input",
        async () => {
          const response = await fetch(
            "http://localhost:8000/authorize?client_id=test-client&response_type=code&scope=openid&resource=http://localhost:8000/mcp&redirect_uri=http://127.0.0.1/callback",
            { redirect: "manual" },
          );

          assertEquals(response.status, 302);
          const location = response.headers.get("location") ?? "";
          assertEquals(
            location.startsWith("https://login.microsoftonline.com/"),
            true,
          );
          await response.text();
        },
      );
    });
  },
});
