import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:contacts-003 - Listeners can list their contacts",
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

          await t.step(
            "list_contacts returns empty list when no contacts exist",
            async () => {
              const { status, result } = await callTool<{
                contacts: unknown[];
                page_size: number;
              }>(token, "list_contacts", {});
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.contacts.length, 0);
            },
          );

          // Create two contacts via different senders
          const domainId1 = crypto.randomUUID();
          const domainId2 = crypto.randomUUID();

          for (
            const [invId, senderDomain, domainId] of [
              [crypto.randomUUID(), "alpha.example", domainId1],
              [crypto.randomUUID(), "beta.example", domainId2],
            ] as [string, string, string][]
          ) {
            await kv.set(["invitations", invId], {
              invitation_id: invId,
              receiver_oid: accountOid,
              sender_domain: senderDomain,
              status: "pending",
              proposed_terms: { category: "billing" },
              claims: {
                immutable: { domain_id: domainId },
                user: { tag: senderDomain },
              },
              created_at: new Date().toISOString(),
            });
            await callTool(token, "accept_invitation", {
              invitation_id: invId,
            });
          }

          await t.step(
            "list_contacts returns all contacts scoped to the caller",
            async () => {
              const { status, result } = await callTool<{
                contacts: Array<{
                  id: string;
                  domain: string;
                  domain_id: string;
                  current_fields: Record<
                    string,
                    { value: unknown }
                  >;
                  created_at: string;
                  updated_at: string;
                }>;
                page_size: number;
              }>(token, "list_contacts", {});
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.contacts.length, 2);
              assertEquals(
                result.contacts.some((c) => c.domain === "alpha.example"),
                true,
              );
              assertEquals(
                result.contacts.some((c) => c.domain === "beta.example"),
                true,
              );
            },
          );

          await t.step(
            "each contact includes id, domain, domain_id, current_fields, timestamps",
            async () => {
              const { result } = await callTool<{
                contacts: Array<{
                  id: string;
                  domain: string;
                  domain_id: string;
                  current_fields: Record<string, { value: unknown }>;
                  created_at: string;
                  updated_at: string;
                }>;
              }>(token, "list_contacts", {});
              assertExists(result);
              for (const contact of result.contacts) {
                assertExists(contact.id);
                assertExists(contact.domain);
                assertExists(contact.domain_id);
                assertExists(contact.current_fields);
                assertExists(contact.created_at);
                assertExists(contact.updated_at);
              }
            },
          );

          await t.step(
            "list_contacts is scoped to the caller — other accounts see only their own contacts",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other User",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const { result } = await callTool<{
                contacts: unknown[];
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
