import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";

Deno.test({
  name: "req:invitations-004 - Listeners can reject a pending invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          const inv = await seedInboundInvitation(kv, { ownerOid });

          await t.step("transitions to rejected", async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              status: string;
            }>(token, "reject_invitation", {
              invitation_id: inv.invitation_id,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.status, "rejected");
            assertEquals(result.invitation_id, inv.invitation_id);
          });

          await t.step(
            "creates no contact for rejected invitation",
            async () => {
              const entries = [];
              for await (
                const e of kv.list({ prefix: ["contacts_by_oid", ownerOid] })
              ) {
                entries.push(e);
              }
              assertEquals(entries.length, 0);
            },
          );

          await t.step("rejecting non-pending invitation errors", async () => {
            const { result, body } = await callTool(
              token,
              "reject_invitation",
              {
                invitation_id: inv.invitation_id,
              },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step(
            "another account cannot reject this invitation",
            async () => {
              const inv2 = await seedInboundInvitation(kv, { ownerOid });
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result, body } = await callTool(
                otherToken,
                "reject_invitation",
                { invitation_id: inv2.invitation_id },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
