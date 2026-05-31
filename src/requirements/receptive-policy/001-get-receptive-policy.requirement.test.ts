import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:receptive-policy-001 - Listeners can list their receptive policies",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step("empty by default for a new account", async () => {
          const token = await issueToken({
            oid: crypto.randomUUID(),
            scope: requiredScopes.join(" "),
            name: "User",
          });
          const { status, result } = await callTool<{
            policies: unknown[];
            page_size: number;
          }>(token, "get_receptive_policies");
          assertEquals(status, 200);
          assertExists(result);
          assertEquals(result.policies.length, 0);
          assertEquals(result.page_size, 0);
        });

        await t.step(
          "lists only the caller's policies (oid isolation)",
          async () => {
            const aliceOid = crypto.randomUUID();
            const bobOid = crypto.randomUUID();
            const alice = await issueToken({
              oid: aliceOid,
              scope: requiredScopes.join(" "),
              name: "Alice",
            });
            const bob = await issueToken({
              oid: bobOid,
              scope: requiredScopes.join(" "),
              name: "Bob",
            });
            await callTool(alice, "add_receptive_policy", { mode: "all" });
            await callTool(bob, "add_receptive_policy", { mode: "closed" });

            const { result: aliceList } = await callTool<{
              policies: Array<{ oid: string; mode: string }>;
            }>(alice, "get_receptive_policies");
            assertExists(aliceList);
            assertEquals(aliceList.policies.length, 1);
            assertEquals(aliceList.policies[0].oid, aliceOid);
            assertEquals(aliceList.policies[0].mode, "all");

            const { result: bobList } = await callTool<{
              policies: Array<{ oid: string; mode: string }>;
            }>(bob, "get_receptive_policies");
            assertExists(bobList);
            assertEquals(bobList.policies.length, 1);
            assertEquals(bobList.policies[0].oid, bobOid);
            assertEquals(bobList.policies[0].mode, "closed");
          },
        );

        await t.step(
          "page_size limits the number of results returned",
          async () => {
            const token = await issueToken({
              oid: crypto.randomUUID(),
              scope: requiredScopes.join(" "),
              name: "User",
            });
            for (let i = 0; i < 5; i++) {
              await callTool(token, "add_receptive_policy", { mode: "all" });
            }
            const { result } = await callTool<{
              policies: unknown[];
              page_size: number;
            }>(token, "get_receptive_policies", { page_size: 2 });
            assertExists(result);
            assertEquals(result.policies.length, 2);
            assertEquals(result.page_size, 2);
          },
        );

        await t.step("each policy record exposes required fields", async () => {
          const token = await issueToken({
            oid: crypto.randomUUID(),
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "add_receptive_policy", {
            mode: "domain_filter",
            domain_filter: {
              rules: [{ action: "allow", pattern: "**.example" }],
            },
          });
          const { result } = await callTool<{
            policies: Array<{
              policy_id: string;
              oid: string;
              mode: string;
              created_at: string;
              domain_filter?: { rules: unknown[] };
            }>;
          }>(token, "get_receptive_policies");
          assertExists(result);
          const p = result.policies[0];
          assertExists(p.policy_id);
          assertExists(p.oid);
          assertExists(p.created_at);
          assertEquals(p.mode, "domain_filter");
          assertExists(p.domain_filter);
          assertEquals(p.domain_filter.rules.length, 1);
        });
      });
    });
  },
});
