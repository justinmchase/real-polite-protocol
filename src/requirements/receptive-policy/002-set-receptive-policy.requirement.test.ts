import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:receptive-policy-002 - Listeners can add a receptive policy",
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
          "mode=all returns a new policy with policy_id + oid",
          async () => {
            const token = await issue();
            const { status, result } = await callTool<{
              policy_id: string;
              mode: string;
              oid: string;
              created_at: string;
            }>(token, "add_receptive_policy", { mode: "all" });
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.policy_id);
            assertExists(result.oid);
            assertExists(result.created_at);
            assertEquals(result.mode, "all");
          },
        );

        await t.step(
          "mode=domain_filter stores the supplied rules",
          async () => {
            const token = await issue();
            const { result } = await callTool<{
              mode: string;
              domain_filter?: {
                rules: Array<{ action: string; pattern: string }>;
              };
            }>(token, "add_receptive_policy", {
              mode: "domain_filter",
              domain_filter: {
                rules: [
                  { action: "allow", pattern: "**.edu" },
                  { action: "block", pattern: "*" },
                ],
              },
            });
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);
            assertEquals(result.domain_filter.rules.length, 2);
            assertEquals(result.domain_filter.rules[0].action, "allow");
            assertEquals(result.domain_filter.rules[0].pattern, "**.edu");
          },
        );

        await t.step(
          "mode=contact stores the (domain, domain_id) pairs",
          async () => {
            const token = await issue();
            const did = crypto.randomUUID();
            const { result } = await callTool<{
              mode: string;
              contacts?: Array<{ domain: string; domain_id: string }>;
            }>(token, "add_receptive_policy", {
              mode: "contact",
              contacts: [{ domain: "example.test", domain_id: did }],
            });
            assertExists(result);
            assertEquals(result.mode, "contact");
            assertExists(result.contacts);
            assertEquals(result.contacts.length, 1);
            assertEquals(result.contacts[0].domain, "example.test");
            assertEquals(result.contacts[0].domain_id, did);
          },
        );

        await t.step(
          "mode=closed is accepted and recorded as closed",
          async () => {
            const token = await issue();
            const { result } = await callTool<{ mode: string }>(
              token,
              "add_receptive_policy",
              { mode: "closed" },
            );
            assertExists(result);
            assertEquals(result.mode, "closed");
          },
        );

        await t.step(
          "policies stack: adding does NOT replace existing",
          async () => {
            const token = await issue();
            await callTool(token, "add_receptive_policy", { mode: "all" });
            await callTool(token, "add_receptive_policy", { mode: "closed" });
            const { result } = await callTool<{ policies: unknown[] }>(
              token,
              "get_receptive_policies",
            );
            assertExists(result);
            assertEquals(result.policies.length, 2);
          },
        );

        await t.step(
          "invalid mode is rejected with a structured error",
          async () => {
            const token = await issue();
            const { result, body } = await callTool(
              token,
              "add_receptive_policy",
              { mode: "receipt" },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          },
        );

        await t.step("each call returns a unique policy_id", async () => {
          const token = await issue();
          const { result: a } = await callTool<{ policy_id: string }>(
            token,
            "add_receptive_policy",
            { mode: "all" },
          );
          const { result: b } = await callTool<{ policy_id: string }>(
            token,
            "add_receptive_policy",
            { mode: "all" },
          );
          assertExists(a);
          assertExists(b);
          assertEquals(a.policy_id !== b.policy_id, true);
        });
      });
    });
  },
});
