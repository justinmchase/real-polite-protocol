import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:invitations-011 - Listeners can list their own public invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        const accountOid = crypto.randomUUID();
        const token = await issueToken({
          oid: accountOid,
          scope: requiredScopes.join(" "),
          name: "Test User",
        });

        await callTool(token, "set_user_verified_metadata");

        // Create two public invitations
        const { result: inv1 } = await callTool<{ invitation_id: string }>(
          token,
          "create_public_invitation",
          { proposed_terms: { category: "correspondence" } },
        );
        const { result: inv2 } = await callTool<{ invitation_id: string }>(
          token,
          "create_public_invitation",
          {
            proposed_terms: { category: "billing" },
            display_name: "Billing Contact",
          },
        );
        assertExists(inv1);
        assertExists(inv2);

        await t.step(
          "list_public_invitations returns created invitations",
          async () => {
            const { status, result } = await callTool<{
              invitations: Array<{ invitation_id: string }>;
            }>(token, "list_public_invitations", {});
            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.invitations);
            const ids = result.invitations.map((i) => i.invitation_id);
            assertEquals(ids.includes(inv1.invitation_id), true);
            assertEquals(ids.includes(inv2.invitation_id), true);
          },
        );

        await t.step(
          "list_public_invitations only returns caller's own invitations",
          async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other User",
            });
            await callTool(otherToken, "set_user_verified_metadata");

            const { result: otherResult } = await callTool<{
              invitations: Array<{ invitation_id: string }>;
            }>(otherToken, "list_public_invitations", {});
            assertExists(otherResult);
            const otherIds = otherResult.invitations.map(
              (i) => i.invitation_id,
            );
            assertEquals(otherIds.includes(inv1.invitation_id), false);
            assertEquals(otherIds.includes(inv2.invitation_id), false);
          },
        );
      });
    });
  },
});
