import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:contacts-004 - Listeners can retrieve a contact with full field history",
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
          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: "partner.example",
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: {
              immutable: { domain_id: senderDomainId },
              user: { name: "Bob" },
              custom: { role: "partner" },
            },
            created_at: new Date().toISOString(),
          });
          await callTool(token, "accept_invitation", { invitation_id: invId });

          // Resolve contact ID via list_contacts
          const { result: list } = await callTool<{
            contacts: Array<{ id: string }>;
          }>(token, "list_contacts", {});
          assertExists(list);
          const contactId = list.contacts[0]?.id;
          assertExists(contactId);

          await t.step(
            "get_contact returns id, domain, domain_id, current_fields, fields, timestamps",
            async () => {
              const { status, result } = await callTool<{
                id: string;
                domain: string;
                domain_id: string;
                current_fields: Record<
                  string,
                  { value: unknown; source: string }
                >;
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string; recorded_at: string }>
                >;
                created_at: string;
                updated_at: string;
              }>(token, "get_contact", { contact_id: contactId });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.id, contactId);
              assertEquals(result.domain, "partner.example");
              assertEquals(result.domain_id, senderDomainId);
              assertExists(result.current_fields);
              assertExists(result.fields);
              assertExists(result.created_at);
              assertExists(result.updated_at);
            },
          );

          await t.step(
            "fields contains full history array per key with value, source, recorded_at",
            async () => {
              const { result } = await callTool<{
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string; recorded_at: string }>
                >;
              }>(token, "get_contact", { contact_id: contactId });
              assertExists(result);
              assertExists(result.fields.name);
              assertEquals(result.fields.name[0].value, "Bob");
              assertEquals(result.fields.name[0].source, "sender_verified");
              assertExists(result.fields.name[0].recorded_at);
              assertExists(result.fields.role);
              assertEquals(result.fields.role[0].value, "partner");
              assertEquals(result.fields.role[0].source, "sender_custom");
            },
          );

          await t.step(
            "get_contact returns a structured error for an unknown contact_id",
            async () => {
              const { status, result } = await callTool<{ ok?: boolean }>(
                token,
                "get_contact",
                { contact_id: crypto.randomUUID() },
              );
              assertEquals(status, 200);
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );

          await t.step(
            "get_contact is scoped to the caller — other account cannot retrieve it",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const { result } = await callTool<{ ok?: boolean }>(
                otherToken,
                "get_contact",
                { contact_id: contactId },
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
