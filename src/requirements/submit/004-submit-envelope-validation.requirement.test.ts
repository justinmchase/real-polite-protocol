import { assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitInvitationEnvelope } from "../helpers/submit-invitation-envelope.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

interface Body {
  code?: string;
  ok?: boolean;
  accepted?: boolean;
}

async function postSigned(
  baseUrl: string,
  contactId: string,
  contactSecret: string,
  body: string | Uint8Array,
): Promise<Response> {
  const bytes = typeof body === "string"
    ? new TextEncoder().encode(body)
    : body;
  const timestamp = new Date().toISOString();
  const sig = await computeHmac(contactSecret, timestamp, bytes);
  return await fetch(`${baseUrl}/rpp/v1/envelopes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rpp-contact-id": contactId,
      "x-rpp-signature": sig,
      "x-rpp-timestamp": timestamp,
    },
    body: bytes,
  });
}

Deno.test({
  name:
    "req:submit-004 - Envelope requests are validated against the category-specific schema before acceptance",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);
      try {
        const ownerOid = crypto.randomUUID();
        const contact = await seedContact(kv, {
          ownerOid,
          remoteDomain: "sender.example",
        });
        const cred = contact.local_credential;

        const baseMessage = () => ({
          message_id: crypto.randomUUID(),
          sender_domain: contact.remote_domain,
          category: "correspondence",
          content_rating: "G",
          sent_at: new Date().toISOString(),
          subject: "Test",
          body: { content_type: "text/markdown", content: "Hello" },
        });

        await t.step(
          "invalid JSON body -> 400 E_INVALID_REQUEST_BODY",
          async () => {
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              "not valid json",
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_REQUEST_BODY",
            );
          },
        );

        await t.step(
          "message missing message_id -> 400 E_INVALID_MESSAGE_ENVELOPE",
          async () => {
            const msg = baseMessage() as Record<string, unknown>;
            delete msg.message_id;
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_MESSAGE_ENVELOPE",
            );
          },
        );

        await t.step(
          "message missing sender_domain -> 400 E_INVALID_MESSAGE_ENVELOPE",
          async () => {
            const msg = baseMessage() as Record<string, unknown>;
            delete msg.sender_domain;
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_MESSAGE_ENVELOPE",
            );
          },
        );

        await t.step(
          "envelope missing category -> 400 E_INVALID_MESSAGE_ENVELOPE",
          async () => {
            const msg = baseMessage() as Record<string, unknown>;
            delete msg.category;
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_MESSAGE_ENVELOPE",
            );
          },
        );

        await t.step(
          "message missing sent_at -> 400 E_INVALID_MESSAGE_ENVELOPE",
          async () => {
            const msg = baseMessage() as Record<string, unknown>;
            delete msg.sent_at;
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_MESSAGE_ENVELOPE",
            );
          },
        );

        await t.step(
          "message missing body -> 400 E_INVALID_MESSAGE_ENVELOPE",
          async () => {
            const msg = baseMessage() as Record<string, unknown>;
            delete msg.body;
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_MESSAGE_ENVELOPE",
            );
          },
        );

        await t.step(
          "message with disallowed content_type -> 400 E_INVALID_CONTENT_TYPE",
          async () => {
            const msg = baseMessage();
            msg.body = { content_type: "text/html", content: "Hello" };
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_CONTENT_TYPE",
            );
          },
        );

        await t.step(
          "application/json body with malformed JSON content -> 400 E_INVALID_BODY",
          async () => {
            const msg = baseMessage();
            msg.body = {
              content_type: "application/json",
              content: "not json {{{",
            };
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 400);
            assertEquals(((await res.json()) as Body).code, "E_INVALID_BODY");
          },
        );

        await t.step(
          "request exceeding 256 KB -> 413 E_ENVELOPE_TOO_LARGE",
          async () => {
            const msg = baseMessage();
            msg.body = {
              content_type: "text/markdown",
              content: "x".repeat(262_145),
            };
            const res = await postSigned(
              baseUrl,
              cred.contact_id,
              cred.contact_secret,
              JSON.stringify(msg),
            );
            assertEquals(res.status, 413);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_ENVELOPE_TOO_LARGE",
            );
          },
        );

        await t.step(
          "valid message envelope -> 202",
          async () => {
            const res = await submitMessageEnvelope({
              baseUrl,
              credential: cred,
              senderDomain: contact.remote_domain,
            });
            assertEquals(res.status, 202);
            const body = (await res.json()) as Body;
            assertEquals(body.ok, true);
            assertEquals(body.accepted, true);
          },
        );

        // ---- Invitation envelope validation ----

        await t.step(
          "invitation envelope missing reply_credential -> 400 E_INVALID_INVITATION_ENVELOPE",
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
            const envelope = {
              category: "invitation",
              invitation_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              sent_at: new Date().toISOString(),
              receptive_policy_id: policyId,
              communication_terms: {
                categories: ["correspondence"],
                max_content_rating: "PG",
              },
              // reply_credential missing
              claims: { immutable: { domain_id: crypto.randomUUID() } },
            };
            const res = await submitInvitationEnvelope({
              baseUrl,
              receptivePolicyId: policyId,
              rawBody: JSON.stringify(envelope),
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_INVITATION_ENVELOPE",
            );
          },
        );

        await t.step(
          "invitation envelope missing claims.immutable.domain_id -> 400 E_INVALID_INVITATION_ENVELOPE",
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
            const envelope = {
              category: "invitation",
              invitation_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              sent_at: new Date().toISOString(),
              receptive_policy_id: policyId,
              communication_terms: {
                categories: ["correspondence"],
                max_content_rating: "PG",
              },
              reply_credential: {
                contact_id: crypto.randomUUID(),
                contact_secret: "a".repeat(32),
              },
              claims: { immutable: {} },
            };
            const res = await submitInvitationEnvelope({
              baseUrl,
              receptivePolicyId: policyId,
              rawBody: JSON.stringify(envelope),
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_INVALID_INVITATION_ENVELOPE",
            );
          },
        );

        await t.step(
          "invitation envelope with neither receptive_policy_id nor shortcode -> 400 E_MISSING_RECEPTIVE_POLICY_ID",
          async () => {
            // To exercise the missing-policy path we must include a policy header
            // (so the identity check passes) but omit it from the envelope body.
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
            const envelope = {
              category: "invitation",
              invitation_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              sent_at: new Date().toISOString(),
              // no receptive_policy_id or shortcode in body
              communication_terms: {
                categories: ["correspondence"],
                max_content_rating: "PG",
              },
              reply_credential: {
                contact_id: crypto.randomUUID(),
                contact_secret: "a".repeat(32),
              },
              claims: { immutable: { domain_id: crypto.randomUUID() } },
            };
            const res = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-receptive-policy-id": policyId,
              },
              body: JSON.stringify(envelope),
            });
            assertEquals(res.status, 400);
            assertEquals(
              ((await res.json()) as Body).code,
              "E_MISSING_RECEPTIVE_POLICY_ID",
            );
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
