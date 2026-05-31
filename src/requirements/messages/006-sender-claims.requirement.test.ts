import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

Deno.test({
  name:
    "req:messages-006 - Message responses include sender claims from contact",
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

          const contact = await seedContact(kv, {
            ownerOid,
            fields: {
              display_name: [{
                value: "Alice",
                source: "sender_verified",
                recorded_at: new Date(),
              }],
              department: [{
                value: "Sales",
                source: "domain_admin",
                recorded_at: new Date(),
              }],
              nickname: [{
                value: "Al",
                source: "sender_custom",
                recorded_at: new Date(),
              }],
              note: [{
                value: "VIP",
                source: "owner_note",
                recorded_at: new Date(),
              }],
            },
          });

          const messageId = crypto.randomUUID();
          const resp = await submitMessageEnvelope({
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
            messageId,
            baseUrl,
          });
          assertEquals(resp.status, 202);
          await resp.body?.cancel();

          await t.step(
            "get_message includes sender_fields from all sources",
            async () => {
              const { result } = await callTool<{
                sender_fields: Record<
                  string,
                  { value: unknown; source: string }
                >;
              }>(token, "get_message", { message_id: messageId });
              assertExists(result);
              assertEquals(result.sender_fields.display_name.value, "Alice");
              assertEquals(
                result.sender_fields.display_name.source,
                "sender_verified",
              );
              assertEquals(result.sender_fields.department.value, "Sales");
              assertEquals(
                result.sender_fields.department.source,
                "domain_admin",
              );
              assertEquals(result.sender_fields.nickname.value, "Al");
              assertEquals(
                result.sender_fields.nickname.source,
                "sender_custom",
              );
              assertEquals(result.sender_fields.note.value, "VIP");
              assertEquals(result.sender_fields.note.source, "owner_note");
            },
          );

          await t.step("list_messages includes sender_fields", async () => {
            const { result } = await callTool<{
              messages: Array<{
                sender_fields: Record<string, { value: unknown }>;
              }>;
            }>(token, "list_messages", {});
            assertExists(result);
            assertEquals(result.messages.length, 1);
            const sf = result.messages[0].sender_fields;
            assertEquals(sf.display_name.value, "Alice");
          });

          await t.step("sender_fields reflects current values", async () => {
            // Mutate the contact's fields directly in KV.
            const stored = await kv.get<Record<string, unknown>>([
              "contacts",
              ownerOid,
              contact.id,
            ]);
            assertExists(stored.value);
            const updated = {
              ...stored.value,
              fields: {
                ...(stored.value as { fields: Record<string, unknown> }).fields,
                display_name: [{
                  value: "Alice (updated)",
                  source: "sender_verified",
                  recorded_at: new Date(),
                }],
              },
            };
            await kv.set(["contacts", ownerOid, contact.id], updated);
            const { result } = await callTool<{
              sender_fields: Record<string, { value: unknown }>;
            }>(token, "get_message", { message_id: messageId });
            assertExists(result);
            assertEquals(
              result.sender_fields.display_name.value,
              "Alice (updated)",
            );
          });

          await t.step(
            "sender_fields is {} when contact deleted",
            async () => {
              // Remove contact rows so the lookup returns nothing.
              await kv.delete(["contacts", ownerOid, contact.id]);
              await kv.delete(["contacts_by_oid", ownerOid, contact.id]);
              const { result } = await callTool<{
                sender_fields: Record<string, unknown>;
              }>(token, "get_message", { message_id: messageId });
              assertExists(result);
              assertEquals(result.sender_fields, {});
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
