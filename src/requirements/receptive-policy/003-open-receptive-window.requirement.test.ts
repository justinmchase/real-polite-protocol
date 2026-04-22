import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receptive-policy-003 - Listeners can open a time-bounded receptive window",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "opening a window returns a new policy with policy_id and receptive_until",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const before = new Date();
            const { status, result } = await callTool<{
              policy_id: string;
              receptive_until?: string;
              mode: string;
            }>(token, "open_receptive_window", { duration_seconds: 60 });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.policy_id);
            assertExists(result.receptive_until);
            assertEquals(result.mode, "all");

            const receptiveUntil = new Date(result.receptive_until!);
            assertEquals(
              receptiveUntil > before,
              true,
              "receptive_until should be in the future",
            );
            assertEquals(
              receptiveUntil.getTime() - before.getTime() > 55_000,
              true,
              "receptive_until should be approximately 60 seconds from now",
            );
          },
        );

        await t.step(
          "window scope defaults to all when not specified",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{ mode: string }>(token, "open_receptive_window", {
              duration_seconds: 30,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.mode, "all");
          },
        );

        await t.step(
          "window with domain_filter scope stores the filter rules",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-003",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{
              mode: string;
              domain_filter?: { rules?: unknown[] };
            }>(token, "open_receptive_window", {
              duration_seconds: 60,
              scope: "domain_filter",
              domain_filter: {
                rules: [{ action: "allow", pattern: "**.edu" }],
              },
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);
            assertEquals(result.domain_filter.rules?.length, 1);
          },
        );

        await t.step(
          "opening multiple windows creates multiple stacked policies",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-004",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { result: w1 } = await callTool<{ policy_id: string }>(token, "open_receptive_window", {
              duration_seconds: 3600,
            });
            const { result: w2 } = await callTool<{ policy_id: string }>(token, "open_receptive_window", {
              duration_seconds: 120,
            });

            assertExists(w1);
            assertExists(w2);
            // Two different policy_ids.
            assertEquals(w1.policy_id !== w2.policy_id, true);

            // Both appear in the list.
            const { result: list } = await callTool<{
              policies: Array<{ policy_id: string }>;
            }>(token, "get_receptive_policies");
            assertExists(list);
            assertEquals(list.policies.length, 2);
          },
        );
      });
    });
  },
});