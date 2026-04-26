import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:receptive-policy-006 - Listeners can remove a receptive policy",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });
          await callTool(token, "set_user_verified_metadata");

          // Create a policy to remove.
          const { result: addResult } = await callTool<{ policy_id: string }>(
            token,
            "add_receptive_policy",
            { mode: "all" },
          );
          assertExists(addResult);
          const policyId = addResult.policy_id;
          assertExists(policyId);

          await t.step(
            "remove_receptive_policy returns policy_id and deleted: true",
            async () => {
              const { status, result } = await callTool<{
                policy_id: string;
                deleted: boolean;
              }>(token, "remove_receptive_policy", { policy_id: policyId });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.policy_id, policyId);
              assertEquals(result.deleted, true);
            },
          );

          await t.step(
            "removed policy no longer appears in get_receptive_policies",
            async () => {
              const { result } = await callTool<{
                policies: Array<{ policy_id: string }>;
              }>(token, "get_receptive_policies", {});
              assertExists(result);
              const found = result.policies.find(
                (p) => p.policy_id === policyId,
              );
              assertEquals(found, undefined);
            },
          );

          await t.step(
            "send_invitation targeting the removed policy is rejected",
            async () => {
              const serverHost = `localhost:${port}`;
              const senderOid = crypto.randomUUID();
              const senderToken = await issueToken({
                oid: senderOid,
                scope: requiredScopes.join(" "),
                name: "Sender",
              });
              await callTool(senderToken, "set_user_verified_metadata");

              const { result } = await callTool<{ ok?: boolean }>(
                senderToken,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: policyId,
                  proposed_terms: { category: "billing" },
                },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );

          await t.step(
            "remove_receptive_policy for another account's policy returns a structured error",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other User",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              // Create a policy on the other account.
              const { result: otherAdd } = await callTool<{
                policy_id: string;
              }>(otherToken, "add_receptive_policy", { mode: "all" });
              assertExists(otherAdd);
              const otherPolicyId = otherAdd.policy_id;

              // Try to remove it as the original account.
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "remove_receptive_policy",
                { policy_id: otherPolicyId },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );

          await t.step(
            "remove_receptive_policy for an unknown policy_id returns a structured error",
            async () => {
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "remove_receptive_policy",
                { policy_id: crypto.randomUUID() },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
