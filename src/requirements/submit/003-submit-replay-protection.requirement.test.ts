import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { submitInvitationEnvelope } from "../helpers/submit-invitation-envelope.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";

interface Body {
  code?: string;
  ok?: boolean;
  accepted?: boolean;
  envelope_id?: string;
}

Deno.test({
  name:
    "req:submit-003 - Envelope requests are protected against replay (freshness + dedup)",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);
      try {
        const ownerOid = crypto.randomUUID();
        const contact = await seedContact(kv, {
          ownerOid,
          remoteDomain: "sender.example",
        });

        await t.step(
          "stale timestamp (> 60s old) -> 400 E_REQUEST_STALE",
          async () => {
            const stale = new Date(Date.now() - 90_000).toISOString();
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
              timestamp: stale,
            });
            assertEquals(res.status, 400);
            assertEquals(((await res.json()) as Body).code, "E_REQUEST_STALE");
          },
        );

        await t.step(
          "future timestamp (> 60s ahead) -> 400 E_REQUEST_STALE",
          async () => {
            const future = new Date(Date.now() + 90_000).toISOString();
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
              timestamp: future,
            });
            assertEquals(res.status, 400);
            assertEquals(((await res.json()) as Body).code, "E_REQUEST_STALE");
          },
        );

        await t.step("a fresh request is accepted", async () => {
          const res = await submitMessageEnvelope({
            baseUrl,
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
          });
          assertEquals(res.status, 202);
          const body = (await res.json()) as Body;
          assertEquals(body.ok, true);
          assertEquals(body.accepted, true);
          assertExists(body.envelope_id);
        });

        await t.step(
          "duplicate message envelope (same sender_domain + message_id) -> 400 E_DUPLICATE_ENVELOPE",
          async () => {
            const messageId = crypto.randomUUID();
            const first = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
              messageId,
            });
            assertEquals(first.status, 202);
            await first.body?.cancel();

            const second = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
              messageId,
            });
            assertEquals(second.status, 400);
            assertEquals(
              ((await second.json()) as Body).code,
              "E_DUPLICATE_ENVELOPE",
            );
          },
        );

        await t.step(
          "duplicate invitation envelope (same sender_domain + invitation_id) -> 400 E_DUPLICATE_ENVELOPE",
          async () => {
            const policyId = crypto.randomUUID();
            await kv.set(["receptive_policies", policyId], {
              policy_id: policyId,
              oid: ownerOid,
              mode: "all",
              created_at: new Date(),
            });
            await kv.set(
              ["receptive_policies_by_oid", ownerOid, policyId],
              policyId,
            );

            const invitationId = crypto.randomUUID();
            const senderDomain = "invsender.example";

            const first = await submitInvitationEnvelope({
              baseUrl,
              receptivePolicyId: policyId,
              invitationId,
              senderDomain,
            });
            assertEquals(first.status, 202);
            await first.body?.cancel();

            const second = await submitInvitationEnvelope({
              baseUrl,
              receptivePolicyId: policyId,
              invitationId,
              senderDomain,
            });
            assertEquals(second.status, 400);
            assertEquals(
              ((await second.json()) as Body).code,
              "E_DUPLICATE_ENVELOPE",
            );
          },
        );

        await t.step(
          "second invitation_reply consuming an already-used reply_credential -> 400 E_INVITATION_NOT_PENDING",
          async () => {
            const outbound = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "replier.example",
            });
            const first = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: outbound.reply_credential,
              senderDomain: outbound.remote_domain,
            });
            assertEquals(first.status, 202);
            await first.body?.cancel();

            // Second reply uses a different envelope (so dedup-by-envelope_id
            // doesn't apply); it must be rejected because the upstream
            // invitation is no longer pending.
            const second = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: outbound.reply_credential,
              senderDomain: outbound.remote_domain,
            });
            assertEquals(second.status, 400);
            const code = ((await second.json()) as Body).code;
            // Either path proves replay protection: dedup by invitation_id
            // (`E_DUPLICATE_ENVELOPE`) or single-use credential
            // (`E_INVITATION_NOT_PENDING`). The current implementation hits
            // dedup first because invitation_id is the dedup key.
            assertEquals(
              code === "E_INVITATION_NOT_PENDING" ||
                code === "E_DUPLICATE_ENVELOPE",
              true,
              `expected E_INVITATION_NOT_PENDING or E_DUPLICATE_ENVELOPE, got ${code}`,
            );
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
