import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:receptive-policy-003 - Listeners can open a time-bounded receptive window",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        const issue = () =>
          issueToken({
            oid: crypto.randomUUID(),
            scope: requiredScopes.join(" "),
            name: "User",
          });

        await t.step(
          "returns policy_id + receptive_until ≈ now+duration",
          async () => {
            const token = await issue();
            const before = Date.now();
            const { status, result } = await callTool<{
              policy_id: string;
              receptive_until: string;
              mode: string;
              domain: string;
            }>(token, "open_receptive_window", { duration_seconds: 60 });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.policy_id);
            assertExists(result.receptive_until);
            const until = new Date(result.receptive_until).getTime();
            assertEquals(until > before, true);
            assertEquals(
              until - before > 55_000 && until - before < 70_000,
              true,
            );
          },
        );

        await t.step("default scope is 'all'", async () => {
          const token = await issue();
          const { result } = await callTool<{ mode: string }>(
            token,
            "open_receptive_window",
            { duration_seconds: 30 },
          );
          assertExists(result);
          assertEquals(result.mode, "all");
        });

        await t.step(
          "scope=domain_filter stores the supplied rules",
          async () => {
            const token = await issue();
            const { result } = await callTool<{
              mode: string;
              domain_filter?: { rules: unknown[] };
            }>(token, "open_receptive_window", {
              duration_seconds: 60,
              scope: "domain_filter",
              domain_filter: {
                rules: [{ action: "allow", pattern: "**.edu" }],
              },
            });
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);
            assertEquals(result.domain_filter.rules.length, 1);
          },
        );

        await t.step("windows stack with existing policies", async () => {
          const token = await issue();
          await callTool(token, "add_receptive_policy", { mode: "all" });
          await callTool(token, "open_receptive_window", {
            duration_seconds: 60,
          });
          const { result } = await callTool<{ policies: unknown[] }>(
            token,
            "get_receptive_policies",
          );
          assertExists(result);
          assertEquals(result.policies.length, 2);
        });

        await t.step("response includes the server's domain", async () => {
          const token = await issue();
          const { result } = await callTool<{ domain?: string }>(
            token,
            "open_receptive_window",
            { duration_seconds: 30 },
          );
          assertExists(result);
          assertExists(result.domain);
        });
      });
    });
  },
});
