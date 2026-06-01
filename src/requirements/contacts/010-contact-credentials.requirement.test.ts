import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";

Deno.test({
  name: "req:contacts-010 - Bilateral contact credentials",
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

          const c = await seedContact(kv, { ownerOid });

          await t.step(
            "local_credential.contact_id != remote_credential.contact_id; both differ from contact.id",
            () => {
              assertEquals(
                c.local_credential.contact_id !==
                  c.remote_credential.contact_id,
                true,
              );
              assertEquals(c.local_credential.contact_id !== c.id, true);
              assertEquals(c.remote_credential.contact_id !== c.id, true);
            },
          );

          await t.step(
            "contact_secret is ≥128 bits of entropy (≥32 hex chars)",
            () => {
              assertEquals(
                c.local_credential.contact_secret.length >= 32,
                true,
              );
              assertEquals(
                c.remote_credential.contact_secret.length >= 32,
                true,
              );
            },
          );

          await t.step(
            "neither secret is returned by list_contacts or get_contact",
            async () => {
              const { result: gc } = await callTool<Record<string, unknown>>(
                token,
                "get_contact",
                { contact_id: c.id },
              );
              assertExists(gc);
              const stringified = JSON.stringify(gc);
              assertEquals(
                stringified.includes(c.local_credential.contact_secret),
                false,
              );
              assertEquals(
                stringified.includes(c.remote_credential.contact_secret),
                false,
              );

              const { result: lc } = await callTool<Record<string, unknown>>(
                token,
                "list_contacts",
                {},
              );
              assertExists(lc);
              const ls = JSON.stringify(lc);
              assertEquals(
                ls.includes(c.local_credential.contact_secret),
                false,
              );
              assertEquals(
                ls.includes(c.remote_credential.contact_secret),
                false,
              );
            },
          );

          await t.step(
            "inbound envelope signed by local_credential is accepted",
            async () => {
              const resp = await submitMessageEnvelope({
                credential: c.local_credential,
                senderDomain: c.remote_domain,
                baseUrl,
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "inbound envelope signed by remote_credential is rejected (wrong direction)",
            async () => {
              // remote_credential is used by THIS server to sign outbound; its
              // contact_id is not registered as an inbound local_credential, so
              // the lookup MUST fail.
              const bodyJson = JSON.stringify({
                message_id: crypto.randomUUID(),
                sender_domain: c.remote_domain,
                category: "correspondence",
                content_rating: "G",
                sent_at: new Date().toISOString(),
                subject: "x",
                body: { content_type: "text/markdown", content: "x" },
              });
              const ts = new Date().toISOString();
              const sig = await computeHmac(
                c.remote_credential.contact_secret,
                ts,
                new TextEncoder().encode(bodyJson),
              );
              const resp = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-rpp-contact-id": c.remote_credential.contact_id,
                  "x-rpp-timestamp": ts,
                  "x-rpp-signature": sig,
                },
                body: bodyJson,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
