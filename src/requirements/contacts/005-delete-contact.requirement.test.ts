import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

Deno.test({
  name: "req:contacts-005 - delete_contact tool",
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

          const contact = await seedContact(kv, { ownerOid });
          // Submit one message for this contact so we can verify cleanup.
          const r = await submitMessageEnvelope({
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
            baseUrl,
          });
          assertEquals(r.status, 202);
          await r.body?.cancel();

          await t.step(
            "returns confirmation { contact_id, deleted: true }",
            async () => {
              const { status, result } = await callTool<{
                contact_id: string;
                deleted: true;
              }>(token, "delete_contact", { contact_id: contact.id });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.contact_id, contact.id);
              assertEquals(result.deleted, true);
            },
          );

          await t.step("contact is gone from get_contact", async () => {
            const { result, body } = await callTool(token, "get_contact", {
              contact_id: contact.id,
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step(
            "freed local_credential.contact_id rejected on inbound",
            async () => {
              const resp = await submitMessageEnvelope({
                credential: contact.local_credential,
                senderDomain: contact.remote_domain,
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "messages from deleted contact are cascade-removed",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ contact_id: string }>;
              }>(token, "list_messages", {});
              assertExists(result);
              const stillPresent = result.messages.some((m) =>
                m.contact_id === contact.id
              );
              assertEquals(stillPresent, false);
            },
          );

          await t.step("unknown contact_id errors", async () => {
            const { result, body } = await callTool(token, "delete_contact", {
              contact_id: crypto.randomUUID(),
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
