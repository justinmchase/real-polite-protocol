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

            await callTool(token, "add_receptive_policy", { mode: "all" });
            await callTool(token, "add_receptive_policy", {
              mode: "domain_filter",
              domain_filter: {
                rules: [{ action: "allow", pattern: "*.example" }],
              },
            });

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
              domain_filter?: {
                rules?: Array<{ action: string; pattern: string }>;
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
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);
            assertEquals(result.domain_filter.rules?.length, 2);
          },
        );

        await t.step(
          "add_receptive_policy returns a structured error when mode is receipt",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-004",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            // "receipt" is not in the add_receptive_policy input schema enum;
            // the tool must reject the call and return an error.
            const { body } = await callTool(token, "add_receptive_policy", {
              mode: "receipt",
            });
            // Either a tool-level error (result.isError) or a protocol error (body.error).
            const isError = body.isError === true ||
              (body.result as { isError?: unknown } | undefined)?.isError ===
                true ||
              body.error != null;
            assertEquals(
              isError,
              true,
              "add_receptive_policy with mode=receipt must return an error",
            );
          },
        );

        await t.step(
          "add_receptive_policy domain_filter accepts and stores glob patterns",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-005",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, result } = await callTool<{
              policy_id: string;
              mode: string;
              domain_filter?: {
                rules?: Array<{ action: string; pattern: string }>;
              };
            }>(token, "add_receptive_policy", {
              mode: "domain_filter",
              domain_filter: {
                rules: [
                  { action: "allow", pattern: "*.university.edu" },
                  { action: "block", pattern: "*" },
                ],
              },
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.mode, "domain_filter");
            assertExists(result.domain_filter);

            const rules = result.domain_filter.rules ?? [];
            assertEquals(rules.length, 2);
            assertEquals(rules[0].action, "allow");
            assertEquals(rules[0].pattern, "*.university.edu");
            assertEquals(rules[1].action, "block");
            assertEquals(rules[1].pattern, "*");

            // Verify the stored policy appears in the list with correct rules.
            const { result: list } = await callTool<{
              policies: Array<{
                policy_id: string;
                domain_filter?: {
                  rules?: Array<{ action: string; pattern: string }>;
                };
              }>;
            }>(token, "get_receptive_policies");
            assertExists(list);
            const stored = list.policies.find(
              (p) => p.policy_id === result.policy_id,
            );
            assertExists(
              stored,
              "policy must appear in get_receptive_policies",
            );
            assertEquals(
              stored.domain_filter?.rules?.[0].pattern,
              "*.university.edu",
            );
          },
        );
      });
    });
  },
});
