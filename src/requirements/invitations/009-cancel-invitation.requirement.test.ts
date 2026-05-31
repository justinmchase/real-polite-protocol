import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";

Deno.test({
  name: "req:invitations-009 - Senders can cancel an outbound invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step("cancels a pending outbound invitation", async () => {
            const inv = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "remote.example",
            });
            const { status, result } = await callTool<{
              invitation_id: string;
              status: string;
            }>(token, "cancel_invitation", {
              invitation_id: inv.invitation_id,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.status, "cancelled");
            assertEquals(result.invitation_id, inv.invitation_id);
          });

          await t.step(
            "post-cancel: late invitation_reply for that invitation is rejected",
            async () => {
              const inv = await seedOutboundInvitation(kv, {
                ownerOid,
                remoteDomain: "remote.example",
              });
              await callTool(token, "cancel_invitation", {
                invitation_id: inv.invitation_id,
              });
              const resp = await submitInvitationReplyEnvelope({
                invitationId: inv.invitation_id,
                signingCredential: inv.reply_credential,
                senderDomain: "remote.example",
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "cancelling a non-pending invitation errors",
            async () => {
              const inv = await seedOutboundInvitation(kv, {
                ownerOid,
                status: "accepted",
              });
              const { result, body } = await callTool(
                token,
                "cancel_invitation",
                { invitation_id: inv.invitation_id },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "another account cannot cancel this invitation",
            async () => {
              const inv = await seedOutboundInvitation(kv, { ownerOid });
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result, body } = await callTool(
                otherToken,
                "cancel_invitation",
                { invitation_id: inv.invitation_id },
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
