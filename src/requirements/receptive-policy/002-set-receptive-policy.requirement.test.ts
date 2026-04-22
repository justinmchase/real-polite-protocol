import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receptive-policy-002 - Listeners can add a receptive policy",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step(
          "add_receptive_policy with mode all returns new policy with policy_id",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{
              policy_id: string;
              mode: string;
              oid: string;
            }>(token, "add_receptive_policy", { mode: "all" });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.policy_id);
            assertEquals(result.mode, "all");
            assertEquals(result.oid, "oid-listener-set-001");

            // Should now appear in the list.
            const { result: list } = await callTool<{
              policies: Array<{ policy_id: string }>;
            }>(token, "get_receptive_policies");
            assertExists(list);
            assertEquals(list.policies.length, 1);
            assertEquals(list.policies[0].policy_id, result.policy_id);
          },
        );

        await t.step(
          "add_receptive_policy stacks — multiple policies coexist",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            await callTool(token, "add_receptive_policy", { mode: "closed" });
            await callTool(token, "add_receptive_policy", { mode: "all" });

            const { result } = await callTool<{
              policies: Array<{ mode: string }>;
            }>(token, "get_receptive_policies");
            assertExists(result);
            assertEquals(result.policies.length, 2);
          },
        );

        await t.step(
          "add_receptive_policy with domain_filter stores filter rules",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-003",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{
              mode: string;
              domain_filter?: { rules?: Array<{ action: string; pattern: string }> };
            }>(token, "add_receptive_policy", {
              mode: "domain_filter",
              domain_filter: {
                rules: [
                  { action: "allow", pattern: "**.edu" },
                  { action: "block", pattern: "*" },
                ],
              },
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);
            assertEquals(result.domain_filter.rules?.length, 2);
          },
        );
      });
    });
  },
});
