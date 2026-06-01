import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name: "req:contacts-002 - Contact field accumulation from envelope claims",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "user/admin/custom claims are merged into contact.fields with the matching sources",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const senderDomainId = crypto.randomUUID();
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain,
                  remoteDomainId: senderDomainId,
                  claims: {
                    immutable: { domain_id: senderDomainId },
                    user: { name: "Alice", email: "alice@x" },
                    admin: { dept: "Eng" },
                    custom: { note: "hi" },
                  },
                });
                const { result } = await callTool<{
                  contact_id: string;
                }>(token, "accept_invitation", {
                  invitation_id: inv.invitation_id,
                  local_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                assertExists(result);
                const { result: contactResult } = await callTool<{
                  fields: Record<
                    string,
                    Array<{ value: unknown; source: string }>
                  >;
                  current_fields: Record<
                    string,
                    { value: unknown; source: string }
                  >;
                }>(token, "get_contact", { contact_id: result.contact_id });
                assertExists(contactResult);
                assertEquals(
                  contactResult.fields.name[0].value,
                  "Alice",
                );
                assertEquals(
                  contactResult.fields.email[0].value,
                  "alice@x",
                );
                assertEquals(
                  contactResult.fields.dept[0].value,
                  "Eng",
                );
                assertEquals(
                  contactResult.fields.note[0].value,
                  "hi",
                );
                // immutable.domain_id is NOT in fields.
                assertEquals(
                  contactResult.fields["domain_id"] === undefined,
                  true,
                );
                // current_fields is the flat-merge.
                assertEquals(
                  contactResult.current_fields.name.value,
                  "Alice",
                );
              });
            },
          );

          await t.step(
            "owner can add a field via set_contact_field (source=owner_note); history preserved",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const senderDomainId = crypto.randomUUID();
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain,
                  remoteDomainId: senderDomainId,
                  claims: {
                    immutable: { domain_id: senderDomainId },
                    user: { name: "Bob" },
                  },
                });
                const { result } = await callTool<{ contact_id: string }>(
                  token,
                  "accept_invitation",
                  {
                    invitation_id: inv.invitation_id,
                    local_terms: {
                      categories: ["correspondence"],
                      max_content_rating: "PG",
                    },
                  },
                );
                assertExists(result);
                await callTool(token, "set_contact_field", {
                  contact_id: result.contact_id,
                  key: "name",
                  value: "Bobby (nickname)",
                });
                const { result: c } = await callTool<{
                  fields: Record<
                    string,
                    Array<{ value: unknown; source: string }>
                  >;
                }>(token, "get_contact", { contact_id: result.contact_id });
                assertExists(c);
                assertEquals(c.fields.name.length, 2);
                assertEquals(c.fields.name[0].value, "Bobby (nickname)");
                assertEquals(c.fields.name[0].source, "owner_note");
                // History preserved: the original sender-verified record is
                // still present further down in the array.
                assertEquals(c.fields.name[1].value, "Bob");
              });
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
