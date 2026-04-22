import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";
import { requiredScopes, withAuthTestContext } from "./test-helpers.ts";

Deno.test({
  name: "req:mcp-auth-005 - Client bearer tokens are never forwarded upstream",
  fn: async (t) => {
    let forwardedAuthorization: string | null = null;

    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl }) => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch(`${baseUrl}/health`);
          assertEquals(res.status, 200);
          await res.text();
        });

        await t.step(
          "does not forward client bearer token on outbound auth fetches",
          async () => {
            const token = await issueToken({ scope: requiredScopes[0] });
            const response = await fetch(`${baseUrl}/mcp`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({}),
            });

            const bodyText = await response.text();
            assertEquals(forwardedAuthorization, null);
            assertEquals(bodyText.includes(token), false);
          },
        );
      });
    }, {
      onJwksRequest: (request) => {
        forwardedAuthorization = request.headers.get("authorization");
      },
    });
  },
});
