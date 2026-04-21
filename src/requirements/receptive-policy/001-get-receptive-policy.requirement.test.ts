import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receptive-policy-001 - Listeners can retrieve their current receptive policy",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step(
          "authenticated user gets closed policy by default",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_receptive_policy",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              oid?: string;
              mode?: string;
            };
            assertEquals(payload.mode, "closed");
          },
        );

        await t.step(
          "policy reflects oid of the authenticated user",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_receptive_policy",
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { oid?: string };
            assertEquals(payload.oid, "oid-listener-002");
          },
        );
      });
    });
  },
});
