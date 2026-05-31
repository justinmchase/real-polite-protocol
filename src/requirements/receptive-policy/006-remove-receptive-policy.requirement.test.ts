import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

const TERMS = {
  categories: ["correspondence"],
  max_content_rating: "PG",
} as const;

Deno.test({
  name: "req:receptive-policy-006 - Listeners can remove a receptive policy",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ port, callTool }) => {
        const serverHost = `localhost:${port}`;

        const ownerOid = crypto.randomUUID();
        const token = await issueToken({
          oid: ownerOid,
          scope: requiredScopes.join(" "),
          name: "Owner",
        });
        await callTool(token, "set_user_verified_metadata");

        const senderOid = crypto.randomUUID();
        const senderToken = await issueToken({
          oid: senderOid,
          scope: requiredScopes.join(" "),
          name: "Sender",
        });
        await callTool(senderToken, "set_user_verified_metadata");

        await t.step(
          "returns {policy_id, deleted: true} and removes from list",
          async () => {
            const { result: add } = await callTool<{ policy_id: string }>(
              token,
              "add_receptive_policy",
              { mode: "all" },
            );
            assertExists(add);
            const { status, result } = await callTool<{
              policy_id: string;
              deleted: boolean;
            }>(token, "remove_receptive_policy", { policy_id: add.policy_id });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.policy_id, add.policy_id);
            assertEquals(result.deleted, true);

            const { result: list } = await callTool<{
              policies: Array<{ policy_id: string }>;
            }>(token, "get_receptive_policies");
            assertExists(list);
            assertEquals(
              list.policies.some((p) => p.policy_id === add.policy_id),
              false,
            );
          },
        );

        await t.step(
          "send_invitation referencing a removed policy is rejected",
          async () => {
            const { result: add } = await callTool<{ policy_id: string }>(
              token,
              "add_receptive_policy",
              { mode: "all" },
            );
            assertExists(add);
            await callTool(token, "remove_receptive_policy", {
              policy_id: add.policy_id,
            });
            const { result, body } = await callTool(
              senderToken,
              "send_invitation",
              {
                receiver_domain: serverHost,
                receptive_policy_id: add.policy_id,
                communication_terms: TERMS,
              },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          },
        );

        await t.step(
          "removing another account's policy returns a structured error",
          async () => {
            const { result: foreignAdd } = await callTool<
              { policy_id: string }
            >(
              senderToken,
              "add_receptive_policy",
              { mode: "all" },
            );
            assertExists(foreignAdd);
            const { result, body } = await callTool(
              token,
              "remove_receptive_policy",
              { policy_id: foreignAdd.policy_id },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          },
        );

        await t.step(
          "unknown policy_id returns a structured error",
          async () => {
            const { result, body } = await callTool(
              token,
              "remove_receptive_policy",
              { policy_id: crypto.randomUUID() },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          },
        );
      });
    });
  },
});
