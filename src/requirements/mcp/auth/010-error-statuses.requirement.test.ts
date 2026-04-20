import { assertEquals } from "@std/assert";
import { withStartedServer } from "../../test-helpers.ts";
import {
  assertAuthFailure,
  requiredScopes,
  testAudience,
  withAuthTestContext,
} from "./test-helpers.ts";

Deno.test({
  name:
    "req:mcp-auth-010 - MCP authentication failures use standardized HTTP status codes",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step("returns 401 for missing tokens", async () => {
          const response = await fetch("http://localhost:8000/mcp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          });

          assertEquals(response.status, 401);
          const body = await response.json();
          assertEquals(body.ok, false);
          assertEquals(body.code, "MISSING_HEADER");
          assertEquals(typeof body.error, "string");
        });

        await t.step("returns 403 for insufficient scope", async () => {
          const token = await issueToken({
            scope: `${testAudience}/custom.scope`,
          });
          await assertAuthFailure(token, 403, "INSUFFICIENT_SCOPE");
        });

        await t.step(
          "returns 400 for malformed authorization token structure",
          async () => {
            const token = await issueToken({
              scope: requiredScopes[0],
              header: { alg: "HS256" },
            });
            const response = await fetch("http://localhost:8000/mcp", {
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
            assertEquals(body.code, "UNSUPPORTED_ALGORITHM");
            assertEquals(typeof body.error, "string");
          },
        );
      });
    });
  },
});
