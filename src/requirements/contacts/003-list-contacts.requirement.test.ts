import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";

Deno.test({
  name: "req:contacts-003 - list_contacts tool",
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

          await seedContact(kv, { ownerOid, remoteDomain: "alpha.example" });
          await seedContact(kv, { ownerOid, remoteDomain: "alpha.example" });
          await seedContact(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            blocked: true,
          });

          await t.step(
            "returns all contacts owned by the caller without secrets",
            async () => {
              const { status, result } = await callTool<{
                contacts: Array<{
                  id: string;
                  remote_domain: string;
                  remote_domain_id: string;
                  local_terms: unknown;
                  remote_terms: unknown;
                  blocked: boolean;
                  current_fields: unknown;
                  local_credential?: { contact_secret?: unknown };
                  remote_credential?: { contact_secret?: unknown };
                }>;
                page_size: number;
              }>(token, "list_contacts", {});
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.contacts.length, 3);
              const c = result.contacts[0];
              assertExists(c.id);
              assertExists(c.remote_domain);
              assertExists(c.remote_domain_id);
              assertEquals(typeof c.blocked, "boolean");
              // Secrets MUST NOT leak.
              for (const x of result.contacts) {
                assertEquals(
                  x.local_credential?.contact_secret === undefined,
                  true,
                );
                assertEquals(
                  x.remote_credential?.contact_secret === undefined,
                  true,
                );
              }
            },
          );

          await t.step("filters by blocked=true", async () => {
            const { result } = await callTool<{
              contacts: Array<{ blocked: boolean }>;
            }>(token, "list_contacts", { blocked: true });
            assertExists(result);
            assertEquals(result.contacts.length, 1);
            assertEquals(result.contacts[0].blocked, true);
          });

          await t.step("filters by blocked=false", async () => {
            const { result } = await callTool<{
              contacts: Array<{ blocked: boolean }>;
            }>(token, "list_contacts", { blocked: false });
            assertExists(result);
            assertEquals(result.contacts.length, 2);
            assertEquals(
              result.contacts.every((c) => c.blocked === false),
              true,
            );
          });

          await t.step("isolated by owner OID", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result } = await callTool<{ contacts: unknown[] }>(
              otherToken,
              "list_contacts",
              {},
            );
            assertExists(result);
            assertEquals(result.contacts.length, 0);
          });

          await t.step("paginates with resume_token", async () => {
            const { result: p1 } = await callTool<{
              contacts: Array<{ id: string }>;
              next_resume_token?: string;
            }>(token, "list_contacts", { page_size: 2 });
            assertExists(p1);
            assertEquals(p1.contacts.length, 2);
            assertExists(p1.next_resume_token);
            const { result: p2 } = await callTool<{
              contacts: Array<{ id: string }>;
            }>(token, "list_contacts", {
              page_size: 2,
              resume_token: p1.next_resume_token,
            });
            assertExists(p2);
            assertEquals(p2.contacts.length, 1);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
