import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";
import { makeCredential } from "../helpers/seed-contact.ts";

Deno.test({
  name:
    "req:invitations-008 - Servers handle inbound invitation_reply envelopes",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "valid invitation_reply transitions outbound to accepted and creates contact",
            async () => {
              const outbound = await seedOutboundInvitation(kv, {
                ownerOid,
                remoteDomain: "remote.example",
              });
              const remoteReply = makeCredential();
              const resp = await submitInvitationReplyEnvelope({
                invitationId: outbound.invitation_id,
                signingCredential: outbound.reply_credential,
                replyCredential: remoteReply,
                senderDomain: "remote.example",
                baseUrl,
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();

              const updated = await kv.get<Record<string, unknown>>([
                "invitations",
                ownerOid,
                outbound.invitation_id,
              ]);
              assertExists(updated.value);
              assertEquals(
                (updated.value as { status: string }).status,
                "accepted",
              );

              // Contact exists.
              const contacts: unknown[] = [];
              for await (
                const e of kv.list({
                  prefix: ["contacts_by_oid", ownerOid],
                })
              ) {
                contacts.push(e);
              }
              assertEquals(contacts.length, 1);
            },
          );

          await t.step(
            "sender_domain mismatch is rejected (E_SENDER_DOMAIN_MISMATCH)",
            async () => {
              const outbound = await seedOutboundInvitation(kv, {
                ownerOid,
                remoteDomain: "intended.example",
              });
              const resp = await submitInvitationReplyEnvelope({
                invitationId: outbound.invitation_id,
                signingCredential: outbound.reply_credential,
                senderDomain: "wrong.example",
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "unknown invitation_id yields E_INVITATION_NOT_FOUND",
            async () => {
              const stranger = makeCredential();
              const resp = await submitInvitationReplyEnvelope({
                invitationId: crypto.randomUUID(),
                signingCredential: stranger,
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "second invitation_reply on same outbound rejected as not pending",
            async () => {
              const outbound = await seedOutboundInvitation(kv, {
                ownerOid,
                remoteDomain: "remote2.example",
              });
              const r1 = await submitInvitationReplyEnvelope({
                invitationId: outbound.invitation_id,
                signingCredential: outbound.reply_credential,
                senderDomain: "remote2.example",
                baseUrl,
              });
              assertEquals(r1.status, 202);
              await r1.body?.cancel();

              const r2 = await submitInvitationReplyEnvelope({
                invitationId: outbound.invitation_id,
                signingCredential: outbound.reply_credential,
                senderDomain: "remote2.example",
                baseUrl,
              });
              assertEquals(r2.status >= 400, true);
              await r2.body?.cancel();
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
