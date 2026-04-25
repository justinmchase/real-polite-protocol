import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:contacts-005 - Listeners can delete a contact",
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
            contacts: Array<{ id: string }>;
          }>(token, "list_contacts", {});
          assertExists(list);
          const contactId = list.contacts[0]?.id;
          assertExists(contactId);

          await t.step(
            "delete_contact returns contact_id and deleted: true",
            async () => {
              const { status, result } = await callTool<{
                contact_id: string;
                deleted: boolean;
              }>(token, "delete_contact", { contact_id: contactId });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.contact_id, contactId);
              assertEquals(result.deleted, true);
            },
          );

          await t.step(
            "deleted contact no longer appears in list_contacts",
            async () => {
              const { result } = await callTool<{
                contacts: Array<{ id: string }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              assertEquals(result.contacts.length, 0);
            },
          );

          await t.step(
            "get_contact on deleted contact returns a structured error",
            async () => {
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "get_contact",
                { contact_id: contactId },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );

          await t.step(
            "delete_contact on a non-existent contact returns a structured error",
            async () => {
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "delete_contact",
                { contact_id: crypto.randomUUID() },
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
