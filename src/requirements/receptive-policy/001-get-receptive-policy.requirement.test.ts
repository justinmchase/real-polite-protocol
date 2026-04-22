import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:receptive-policy-001 - Listeners can list their receptive policies",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "authenticated user gets empty list by default",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{
              policies: Array<unknown>;
              page_size: number;
            }>(token, "get_receptive_policies");
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.policies.length, 0);
          },
        );

        await t.step(
          "policies belong to the authenticated user",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            // Add a policy so there is something to list.
            await callTool(token, "add_receptive_policy", { mode: "all" });

            const { status, result } = await callTool<{
              policies: Array<{ oid: string; policy_id: string }>;
              page_size: number;
            }>(token, "get_receptive_policies");
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.policies.length, 1);
            assertEquals(result.policies[0].oid, "oid-listener-002");
            assertExists(result.policies[0].policy_id);
          },
        );
      });
    });
  },
});
