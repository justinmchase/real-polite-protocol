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
      await withStartedServer(async ({ callTool, kvPath }) => {
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

        await t.step(
          "get_receptive_policies omits receipt-mode policies by default and includes them when include_receipt_policies is true",
          async () => {
            const oid = "oid-listener-receipt-filter";
            const token = await issueToken({
              oid,
              roles: [],
              scope: requiredScopes.join(" "),
            });

            // Seed a receipt-mode policy directly in KV (simulating the
            // side-effect of accept_invitation with a sender domain_id).
            const policyId = crypto.randomUUID();
            const receiptId = crypto.randomUUID();
            const kv = await Deno.openKv(kvPath);
            try {
              const policy = {
                policy_id: policyId,
                oid,
                mode: "receipt",
                receipt_id: receiptId,
                created_at: new Date(),
              };
              await kv.set(["receptive_policies", policyId], policy);
              await kv.set(
                ["receptive_policies_by_oid", oid, policyId],
                policy,
              );
            } finally {
              kv.close();
            }

            // Default call must omit receipt-mode policies.
            const { result: withoutFlag } = await callTool<{
              policies: Array<{ mode: string; policy_id: string }>;
            }>(token, "get_receptive_policies");
            assertExists(withoutFlag);
            const ids = withoutFlag.policies.map((p) => p.policy_id);
            assertEquals(
              ids.includes(policyId),
              false,
              "receipt-mode policy must be omitted from default listing",
            );

            // With include_receipt_policies: true, it must appear.
            const { result: withFlag } = await callTool<{
              policies: Array<{ mode: string; policy_id: string }>;
            }>(token, "get_receptive_policies", {
              include_receipt_policies: true,
            });
            assertExists(withFlag);
            const idsWithFlag = withFlag.policies.map((p) => p.policy_id);
            assertEquals(
              idsWithFlag.includes(policyId),
              true,
              "receipt-mode policy must appear when include_receipt_policies is true",
            );
          },
        );
      });
    });
  },
});
