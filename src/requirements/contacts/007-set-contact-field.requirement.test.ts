import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:contacts-007 - Owner can add custom fields to a contact",
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

          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: crypto.randomUUID() } },
            created_at: new Date().toISOString(),
          });
          await callTool(token, "accept_invitation", { invitation_id: invId });

          const { result: list } = await callTool<{
            contacts: Array<{ id: string; updated_at: string }>;
          }>(token, "list_contacts", {});
          assertExists(list);
          const contact = list.contacts[0];
          assertExists(contact);
          const contactId = contact.id;
          const originalUpdatedAt = contact.updated_at;

          await t.step(
            "set_contact_field prepends a new record and returns the updated contact",
            async () => {
              const { status, result } = await callTool<{
                id: string;
                current_fields: Record<
                  string,
                  { value: unknown; source: string }
                >;
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string; recorded_at: string }>
                >;
                updated_at: string;
              }>(token, "set_contact_field", {
                contact_id: contactId,
                key: "note",
                value: "Met at conference",
              });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.id, contactId);
              assertExists(result.current_fields.note);
              assertEquals(
                result.current_fields.note.value,
                "Met at conference",
              );
              assertEquals(result.current_fields.note.source, "owner_note");
              assertExists(result.fields.note);
              assertEquals(result.fields.note[0].value, "Met at conference");
              assertEquals(result.fields.note[0].source, "owner_note");
              assertExists(result.fields.note[0].recorded_at);
            },
          );

          await t.step(
            "updated_at is refreshed after set_contact_field",
            async () => {
              const { result } = await callTool<{ updated_at: string }>(
                token,
                "get_contact",
                { contact_id: contactId },
              );
              assertExists(result);
              // updated_at must be at least as recent as the original
              assertEquals(
                new Date(result.updated_at) >= new Date(originalUpdatedAt),
                true,
              );
            },
          );

          await t.step(
            "calling set_contact_field again prepends to history without removing old entries",
            async () => {
              await callTool(token, "set_contact_field", {
                contact_id: contactId,
                key: "note",
                value: "Follow-up scheduled",
              });

              const { result } = await callTool<{
                fields: Record<
                  string,
                  Array<{ value: unknown }>
                >;
              }>(token, "get_contact", { contact_id: contactId });
              assertExists(result);
              assertEquals(result.fields.note.length, 2);
              assertEquals(
                result.fields.note[0].value,
                "Follow-up scheduled",
              );
              assertEquals(result.fields.note[1].value, "Met at conference");
            },
          );

          await t.step(
            "set_contact_field on a non-existent contact returns a structured error",
            async () => {
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "set_contact_field",
                {
                  contact_id: crypto.randomUUID(),
                  key: "note",
                  value: "hello",
                },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
