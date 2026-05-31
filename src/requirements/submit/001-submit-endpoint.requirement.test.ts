import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { submitInvitationEnvelope } from "../helpers/submit-invitation-envelope.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";

Deno.test({
  name:
    "req:submit-001 - Servers expose an envelope endpoint that accepts message, invitation, and invitation_reply envelopes",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);
      try {
        const ownerOid = crypto.randomUUID();

        await t.step(
          "POST /rpp/v1/envelopes accepts a message envelope (202, { ok, accepted, envelope_id })",
          async () => {
            const contact = await seedContact(kv, {
              ownerOid,
              remoteDomain: "sender.example",
            });
            const response = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
            });
            assertEquals(response.status, 202);
            const payload = await response.json() as Record<string, unknown>;
            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
            assertExists(payload.envelope_id);
          },
        );

        await t.step(
          "POST /rpp/v1/envelopes accepts an invitation envelope (202, uniform shape)",
          async () => {
            // Seed a receptive policy in `all` mode.
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

            const response = await submitInvitationEnvelope({
              baseUrl,
              receptivePolicyId: policyId,
              senderDomain: "remote.example",
            });
            assertEquals(response.status, 202);
            const payload = await response.json() as Record<string, unknown>;
            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
            assertExists(payload.envelope_id);
          },
        );

        await t.step(
          "POST /rpp/v1/envelopes accepts an invitation_reply envelope (202, uniform shape)",
          async () => {
            const outbound = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "remote.example",
            });
            const response = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: outbound.reply_credential,
              senderDomain: outbound.remote_domain,
            });
            assertEquals(response.status, 202);
            const payload = await response.json() as Record<string, unknown>;
            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
            assertExists(payload.envelope_id);
          },
        );

        await t.step(
          "envelope endpoint is accessible at POST /rpp/v1/envelopes (no 404)",
          async () => {
            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            });
            assertEquals(
              response.status === 404,
              false,
              "POST /rpp/v1/envelopes must not return 404",
            );
            await response.body?.cancel();
          },
        );

        await t.step(
          "multiple message deliveries require multiple independent submissions",
          async () => {
            const contact = await seedContact(kv, {
              ownerOid,
              remoteDomain: "fanout.example",
            });
            const first = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
            });
            const second = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
            });
            assertEquals(first.status, 202);
            assertEquals(second.status, 202);
            await first.body?.cancel();
            await second.body?.cancel();
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
