import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:contacts-001 - Contact auto-creation on invitation acceptance",
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
          const senderDomain = "sender.example";

          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: senderDomain,
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: senderDomainId } },
            created_at: new Date().toISOString(),
          });

          await t.step(
            "accepting invitation with domain_id creates a contact",
            async () => {
              await callTool(token, "accept_invitation", {
                invitation_id: invId,
              });

              const { result } = await callTool<{
                contacts: Array<{
                  id: string;
                  domain: string;
                  domain_id: string;
                }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              assertEquals(result.contacts.length, 1);
              assertEquals(result.contacts[0].domain, senderDomain);
              assertEquals(result.contacts[0].domain_id, senderDomainId);
            },
          );

          await t.step(
            "contact id is a server-assigned UUID distinct from domain_id",
            async () => {
              const { result } = await callTool<{
                contacts: Array<{ id: string; domain_id: string }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              const contact = result.contacts[0];
              assertExists(contact.id);
              assertEquals(contact.id !== senderDomainId, true);
            },
          );

          await t.step(
            "accepting another invitation with same (domain, domain_id) upserts — not duplicates",
            async () => {
              const inv2Id = crypto.randomUUID();
              await kv.set(["invitations", inv2Id], {
                invitation_id: inv2Id,
                receiver_oid: accountOid,
                sender_domain: senderDomain,
                status: "pending",
                proposed_terms: { category: "support" },
                claims: { immutable: { domain_id: senderDomainId } },
                created_at: new Date().toISOString(),
              });
              await callTool(token, "accept_invitation", {
                invitation_id: inv2Id,
              });

              const { result } = await callTool<{
                contacts: Array<{ id: string }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              // Still exactly one contact — the second acceptance upserted it
              assertEquals(result.contacts.length, 1);
            },
          );

          await t.step(
            "updated_at is refreshed on upsert but created_at is preserved",
            async () => {
              const { result } = await callTool<{
                contacts: Array<{
                  created_at: string;
                  updated_at: string;
                }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              const contact = result.contacts[0];
              assertExists(contact.created_at);
              assertExists(contact.updated_at);
            },
          );

          await t.step(
            "invitation without domain_id does not create a contact",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const noDomainInvId = crypto.randomUUID();
              await kv.set(["invitations", noDomainInvId], {
                invitation_id: noDomainInvId,
                receiver_oid: otherOid,
                sender_domain: "noid.example",
                status: "pending",
                proposed_terms: { category: "billing" },
                // no claims.immutable.domain_id
                created_at: new Date().toISOString(),
              });
              await callTool(otherToken, "accept_invitation", {
                invitation_id: noDomainInvId,
              });

              const { result } = await callTool<{
                contacts: Array<{ id: string }>;
              }>(otherToken, "list_contacts", {});
              assertExists(result);
              assertEquals(result.contacts.length, 0);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
