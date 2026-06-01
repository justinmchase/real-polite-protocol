import { assertEquals, assertNotEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { submitInvitationEnvelope } from "../helpers/submit-invitation-envelope.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";

interface ErrorBody {
  code?: string;
}

Deno.test({
  name:
    "req:submit-002 - Envelope requests are authenticated with per-contact HMAC signatures",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);
      try {
        const ownerOid = crypto.randomUUID();

        // -------- message-envelope auth -------------------------------------
        const contact = await seedContact(kv, {
          ownerOid,
          remoteDomain: "sender.example",
        });

        const buildMessage = () => {
          const envelope = {
            message_id: crypto.randomUUID(),
            sender_domain: contact.remote_domain,
            category: "correspondence",
            content_rating: "G",
            sent_at: new Date().toISOString(),
            subject: "Hi",
            body: { content_type: "text/markdown", content: "hello" },
          };
          const json = JSON.stringify(envelope);
          return { json, bytes: new TextEncoder().encode(json) };
        };

        await t.step(
          "message: missing x-rpp-contact-id -> 400 E_MISSING_CONTACT_ID",
          async () => {
            const { json, bytes } = buildMessage();
            const ts = new Date().toISOString();
            const sig = await computeHmac(
              contact.local_credential.contact_secret,
              ts,
              bytes,
            );
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-signature": sig,
                "x-rpp-timestamp": ts,
              },
              body: json,
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_MISSING_CONTACT_ID",
            );
          },
        );

        await t.step(
          "message: missing x-rpp-signature -> 400 E_MISSING_SIGNATURE",
          async () => {
            const { json } = buildMessage();
            const ts = new Date().toISOString();
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-contact-id": contact.local_credential.contact_id,
                "x-rpp-timestamp": ts,
              },
              body: json,
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_MISSING_SIGNATURE",
            );
          },
        );

        await t.step(
          "message: missing x-rpp-timestamp -> 400 E_MISSING_TIMESTAMP",
          async () => {
            const { json, bytes } = buildMessage();
            const ts = new Date().toISOString();
            const sig = await computeHmac(
              contact.local_credential.contact_secret,
              ts,
              bytes,
            );
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-contact-id": contact.local_credential.contact_id,
                "x-rpp-signature": sig,
              },
              body: json,
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_MISSING_TIMESTAMP",
            );
          },
        );

        await t.step(
          "message: unknown x-rpp-contact-id -> 403 E_CONTACT_NOT_FOUND",
          async () => {
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: {
                contact_id: crypto.randomUUID(),
                contact_secret: contact.local_credential.contact_secret,
              },
              senderDomain: contact.remote_domain,
            });
            assertEquals(res.status, 403);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_CONTACT_NOT_FOUND",
            );
          },
        );

        await t.step(
          "message: invalid HMAC -> 403 E_SIGNATURE_INVALID (not 401)",
          async () => {
            const { json } = buildMessage();
            const ts = new Date().toISOString();
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-contact-id": contact.local_credential.contact_id,
                "x-rpp-signature": "f".repeat(64),
                "x-rpp-timestamp": ts,
              },
              body: json,
            });
            assertEquals(res.status, 403);
            assertNotEquals(res.status, 401);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_SIGNATURE_INVALID",
            );
          },
        );

        await t.step(
          "message: blocked contact -> 403 E_CONTACT_BLOCKED",
          async () => {
            const blocked = await seedContact(kv, {
              ownerOid,
              remoteDomain: "blocked.example",
              blocked: true,
            });
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: blocked.local_credential,
              senderDomain: blocked.remote_domain,
            });
            assertEquals(res.status, 403);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_CONTACT_BLOCKED",
            );
          },
        );

        await t.step(
          "message: sender_domain != contact.remote_domain -> 403 E_SENDER_DOMAIN_MISMATCH",
          async () => {
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: "other.example",
            });
            assertEquals(res.status, 403);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_SENDER_DOMAIN_MISMATCH",
            );
          },
        );

        await t.step(
          "message: both x-rpp-contact-id and x-rpp-receptive-policy-id -> 400 E_INVALID_AUTH_HEADERS",
          async () => {
            const { json, bytes } = buildMessage();
            const ts = new Date().toISOString();
            const sig = await computeHmac(
              contact.local_credential.contact_secret,
              ts,
              bytes,
            );
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-contact-id": contact.local_credential.contact_id,
                "x-rpp-receptive-policy-id": crypto.randomUUID(),
                "x-rpp-signature": sig,
                "x-rpp-timestamp": ts,
              },
              body: json,
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_INVALID_AUTH_HEADERS",
            );
          },
        );

        await t.step(
          "message: valid contact + HMAC -> 202",
          async () => {
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
            });
            assertEquals(res.status, 202);
            await res.body?.cancel();
          },
        );

        // -------- invitation-envelope auth ---------------------------------
        await t.step(
          "invitation: x-rpp-contact-id used instead of policy header -> 400 E_INVALID_AUTH_HEADERS",
          async () => {
            const res = await submitInvitationEnvelope({
              baseUrl,
              omitPolicyHeader: true,
            });
            // omitPolicyHeader=true sends no identity header, so classification
            // (invitation) -> assertSingleIdentityHeader -> E_INVALID_AUTH_HEADERS.
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_INVALID_AUTH_HEADERS",
            );
          },
        );

        // -------- invitation_reply-envelope auth ---------------------------
        await t.step(
          "invitation_reply: signed with outbound reply_credential -> 202",
          async () => {
            const outbound = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "partner.example",
            });
            const res = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: outbound.reply_credential,
              senderDomain: outbound.remote_domain,
            });
            assertEquals(res.status, 202);
            await res.body?.cancel();
          },
        );

        await t.step(
          "invitation_reply: wrong x-rpp-contact-id -> 403 E_CONTACT_NOT_FOUND",
          async () => {
            const outbound = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "partner2.example",
            });
            const res = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: {
                contact_id: crypto.randomUUID(),
                contact_secret: outbound.reply_credential.contact_secret,
              },
              senderDomain: outbound.remote_domain,
            });
            assertEquals(res.status, 403);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_CONTACT_NOT_FOUND",
            );
          },
        );

        await t.step(
          "invitation_reply: bad HMAC -> 403 E_SIGNATURE_INVALID",
          async () => {
            const outbound = await seedOutboundInvitation(kv, {
              ownerOid,
              remoteDomain: "partner3.example",
            });
            const res = await submitInvitationReplyEnvelope({
              baseUrl,
              invitationId: outbound.invitation_id,
              signingCredential: {
                contact_id: outbound.reply_credential.contact_id,
                contact_secret: "wrong-secret",
              },
              senderDomain: outbound.remote_domain,
            });
            assertEquals(res.status, 403);
            assertEquals(
              ((await res.json()) as ErrorBody).code,
              "E_SIGNATURE_INVALID",
            );
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
