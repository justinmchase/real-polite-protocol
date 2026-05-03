import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../helpers/with-started-server.ts";
import {
  requiredScopes,
  testAudience,
  withAuthTestContext,
} from "../../helpers/with-auth-test-context.ts";
import { assertAuthFailure } from "../../helpers/assert-auth-failure.ts";

Deno.test({
  name:
    "req:mcp-auth-010 - MCP authentication failures use standardized HTTP status codes",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl }) => {
        await t.step("returns 401 for missing tokens", async () => {
          const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const body = await response.json();
          assertEquals(body.ok, false);
          assertEquals(body.code, "E_MISSING_HEADER");
          assertEquals(typeof body.error, "string");
        });

        await t.step("returns 403 for insufficient scope", async () => {
          const token = await issueToken({
            scope: `${testAudience}/custom.scope`,
          });
          await assertAuthFailure(token, 403, "E_INSUFFICIENT_SCOPE", baseUrl);
        });

        await t.step(
          "returns 400 for malformed authorization token structure",
          async () => {
            const token = await issueToken({
              scope: requiredScopes[0],
              header: { alg: "HS256" },
            });
            const response = await fetch(`${baseUrl}/mcp`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({}),
            });

            assertEquals(response.status, 400);
            const body = await response.json();
            assertEquals(body.ok, false);
            assertEquals(body.code, "E_UNSUPPORTED_ALGORITHM");
            assertEquals(typeof body.error, "string");
          },
        );

        await t.step(
          "auth error response body contains a machine-readable E_-prefixed error code",
          async () => {
            // Verify the contract that ALL auth errors use E_ prefix codes.
            const response = await fetch(`${baseUrl}/mcp`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({}),
            });

            assertEquals(response.status, 401);
            const body = await response.json();
            assertEquals(body.ok, false);
            assertEquals(
              typeof body.code,
              "string",
              "error body must have a string code field",
            );
            assertEquals(
              (body.code as string).startsWith("E_"),
              true,
              `error code "${body.code}" must start with "E_"`,
            );
          },
        );
      });
    });
  },
});
