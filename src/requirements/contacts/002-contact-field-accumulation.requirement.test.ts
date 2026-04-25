import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:contacts-002 - Contact field accumulation from invitation claims",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });
          await callTool(token, "set_user_verified_metadata");

          const senderDomainId = crypto.randomUUID();

          const inv1Id = crypto.randomUUID();
          await kv.set(["invitations", inv1Id], {
            invitation_id: inv1Id,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: {
              immutable: { domain_id: senderDomainId },
              user: { name: "Alice" },
              custom: { note: "first contact" },
            },
            created_at: new Date().toISOString(),
          });

          await callTool(token, "accept_invitation", { invitation_id: inv1Id });

          let contactId: string | undefined;

          await t.step(
            "fields from user and custom claim namespaces are stored on the contact",
            async () => {
              const { result } = await callTool<{
                contacts: Array<{
                  id: string;
                  current_fields: Record<
                    string,
                    { value: unknown; source: string }
                  >;
                }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              assertEquals(result.contacts.length, 1);
              const contact = result.contacts[0];
              contactId = contact.id;
              assertExists(contact.current_fields.name);
              assertEquals(contact.current_fields.name.value, "Alice");
              assertEquals(contact.current_fields.name.source, "sender_verified");
              assertExists(contact.current_fields.note);
              assertEquals(
                contact.current_fields.note.value,
                "first contact",
              );
              assertEquals(contact.current_fields.note.source, "sender_custom");
            },
          );

          await t.step(
            "get_contact returns full field history per key",
            async () => {
              assertExists(contactId);
              const { result } = await callTool<{
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string; recorded_at: string }>
                >;
              }>(token, "get_contact", { contact_id: contactId });
              assertExists(result);
              assertExists(result.fields.name);
              assertEquals(result.fields.name.length, 1);
              assertEquals(result.fields.name[0].value, "Alice");
              assertEquals(result.fields.name[0].source, "sender_verified");
              assertExists(result.fields.name[0].recorded_at);
            },
          );

          await t.step(
            "accepting a second invitation prepends new records to field history",
            async () => {
              const inv2Id = crypto.randomUUID();
              await kv.set(["invitations", inv2Id], {
                invitation_id: inv2Id,
                receiver_oid: accountOid,
                sender_domain: "sender.example",
                status: "pending",
                proposed_terms: { category: "support" },
                claims: {
                  immutable: { domain_id: senderDomainId },
                  user: { name: "Alice Smith" },
                  custom: { note: "name updated" },
                },
                created_at: new Date().toISOString(),
              });
              await callTool(token, "accept_invitation", {
                invitation_id: inv2Id,
              });

              assertExists(contactId);
              const { result } = await callTool<{
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string }>
                >;
              }>(token, "get_contact", { contact_id: contactId });
              assertExists(result);
              // History now has two name records; most-recent (index 0) is the new one
              assertEquals(result.fields.name.length, 2);
              assertEquals(result.fields.name[0].value, "Alice Smith");
              assertEquals(result.fields.name[1].value, "Alice");
            },
          );

          await t.step(
            "flat-merge current_fields reflects only the most-recent record",
            async () => {
              assertExists(contactId);
              const { result } = await callTool<{
                current_fields: Record<
                  string,
                  { value: unknown; source: string }
                >;
              }>(token, "get_contact", { contact_id: contactId });
              assertExists(result);
              assertEquals(result.current_fields.name.value, "Alice Smith");
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
