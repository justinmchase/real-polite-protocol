import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";
import { withFailingRemoteServer } from "../helpers/with-failing-remote-server.ts";

Deno.test({
  name:
    "req:messages-008 - Listeners can list messages they have sent (outbox)",
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

          // Send three messages to a remote (stub) and one failure.
          await withRemoteServer(async (remoteDomain) => {
            const a = await seedContact(kv, {
              ownerOid,
              remoteDomain,
              remoteTerms: {
                categories: ["correspondence", "billing"],
                max_content_rating: "PG",
              },
            });
            for (const cat of ["correspondence", "billing", "billing"]) {
              const { result } = await callTool<{ accepted: boolean }>(
                token,
                "send_message",
                {
                  contact_id: a.id,
                  category: cat,
                  content_rating: "G",
                  subject: `S-${cat}`,
                  body: { content_type: "text/markdown", content: "x" },
                },
              );
              assertExists(result);
            }
          });

          let failedContactId = "";
          await withFailingRemoteServer(500, async (remoteDomain) => {
            const b = await seedContact(kv, {
              ownerOid,
              remoteDomain,
            });
            failedContactId = b.id;
            await callTool(token, "send_message", {
              contact_id: b.id,
              category: "correspondence",
              content_rating: "G",
              body: { content_type: "text/markdown", content: "x" },
            });
          });

          await t.step(
            "list_sent_messages returns all outbox records",
            async () => {
              const { status, result } = await callTool<{
                messages: Array<{
                  id: string;
                  contact_id: string;
                  message_id: string;
                  remote_domain: string;
                  category: string;
                  content_rating: string;
                  sent_at: string;
                  body: unknown;
                  status: "delivered" | "failed";
                }>;
                page_size: number;
              }>(token, "list_sent_messages", {});
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.messages.length, 4);
              const statuses = result.messages.map((m) => m.status).sort();
              assertEquals(statuses, [
                "delivered",
                "delivered",
                "delivered",
                "failed",
              ]);
            },
          );

          await t.step("filters by category", async () => {
            const { result } = await callTool<{
              messages: Array<{ category: string }>;
            }>(token, "list_sent_messages", { category: "billing" });
            assertExists(result);
            assertEquals(result.messages.length, 2);
            assertEquals(
              result.messages.every((m) => m.category === "billing"),
              true,
            );
          });

          await t.step("filters by status=failed", async () => {
            const { result } = await callTool<{
              messages: Array<{ status: string; contact_id: string }>;
            }>(token, "list_sent_messages", { status: "failed" });
            assertExists(result);
            assertEquals(result.messages.length, 1);
            assertEquals(result.messages[0].status, "failed");
            assertEquals(result.messages[0].contact_id, failedContactId);
          });

          await t.step("filters by contact_id", async () => {
            const { result } = await callTool<{
              messages: Array<{ contact_id: string }>;
            }>(token, "list_sent_messages", { contact_id: failedContactId });
            assertExists(result);
            assertEquals(result.messages.length, 1);
          });

          await t.step("ordered by sent_at descending", async () => {
            const { result } = await callTool<{
              messages: Array<{ sent_at: string }>;
            }>(token, "list_sent_messages", {});
            assertExists(result);
            const ts = result.messages.map((m) =>
              new Date(m.sent_at).getTime()
            );
            for (let i = 1; i < ts.length; i++) {
              assertEquals(ts[i - 1] >= ts[i], true);
            }
          });

          await t.step("paginates via resume_token", async () => {
            const { result: p1 } = await callTool<{
              messages: Array<{ id: string }>;
              next_resume_token?: string;
            }>(token, "list_sent_messages", { page_size: 2 });
            assertExists(p1);
            assertEquals(p1.messages.length, 2);
            assertExists(p1.next_resume_token);
            const { result: p2 } = await callTool<{
              messages: Array<{ id: string }>;
            }>(token, "list_sent_messages", {
              page_size: 2,
              resume_token: p1.next_resume_token,
            });
            assertExists(p2);
            assertEquals(p2.messages.length, 2);
            const ids1 = p1.messages.map((m) => m.id);
            const ids2 = p2.messages.map((m) => m.id);
            assertEquals(ids1.filter((id) => ids2.includes(id)).length, 0);
          });

          await t.step("outbox isolated by owner OID", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result } = await callTool<{
              messages: Array<unknown>;
            }>(otherToken, "list_sent_messages", {});
            assertExists(result);
            assertEquals(result.messages.length, 0);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
