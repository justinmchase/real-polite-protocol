import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

Deno.test({
  name: "req:messages-002 - Listeners can list messages in their inbox",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });
          await callTool(token, "set_user_verified_metadata");

          const contactA = await seedContact(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            remoteTerms: {
              categories: ["billing", "correspondence"],
              max_content_rating: "PG",
            },
            localTerms: {
              categories: ["billing", "correspondence"],
              max_content_rating: "PG",
            },
          });
          const contactB = await seedContact(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            remoteTerms: {
              categories: ["correspondence"],
              max_content_rating: "PG",
            },
            localTerms: {
              categories: ["correspondence"],
              max_content_rating: "PG",
            },
          });

          const a1 = await submitMessageEnvelope({
            credential: contactA.local_credential,
            senderDomain: contactA.remote_domain,
            category: "billing",
            subject: "Invoice #1",
            baseUrl,
          });
          assertEquals(a1.status, 202);
          await a1.body?.cancel();

          const a2 = await submitMessageEnvelope({
            credential: contactA.local_credential,
            senderDomain: contactA.remote_domain,
            category: "billing",
            subject: "Invoice #2",
            baseUrl,
          });
          assertEquals(a2.status, 202);
          await a2.body?.cancel();

          const b1 = await submitMessageEnvelope({
            credential: contactB.local_credential,
            senderDomain: contactB.remote_domain,
            category: "correspondence",
            subject: "Hello",
            baseUrl,
          });
          assertEquals(b1.status, 202);
          await b1.body?.cancel();

          await t.step("returns all messages for caller", async () => {
            const { status, result } = await callTool<{
              messages: Array<{
                id: string;
                contact_id: string;
                message_id: string;
                remote_domain: string;
                category: string;
                content_rating: string;
                sent_at: string;
                received_at: string;
                read: boolean;
                message: { subject: string; body: unknown };
                sender_fields: Record<string, unknown>;
              }>;
              page_size: number;
            }>(token, "list_messages", {});
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.messages.length, 3);
            assertEquals(typeof result.page_size, "number");
            const m = result.messages[0];
            assertExists(m.id);
            assertExists(m.contact_id);
            assertExists(m.message_id);
            assertExists(m.remote_domain);
            assertExists(m.category);
            assertExists(m.content_rating);
            assertExists(m.sent_at);
            assertExists(m.received_at);
            assertEquals(typeof m.read, "boolean");
            assertExists(m.message.subject);
            assertExists(m.sender_fields);
          });

          await t.step(
            "results ordered by received_at descending",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ received_at: string }>;
              }>(token, "list_messages", {});
              assertExists(result);
              const ts = result.messages.map((m) =>
                new Date(m.received_at).getTime()
              );
              for (let i = 1; i < ts.length; i++) {
                assertEquals(ts[i - 1] >= ts[i], true);
              }
            },
          );

          await t.step("filters by category", async () => {
            const { result } = await callTool<{
              messages: Array<{ category: string }>;
            }>(token, "list_messages", { category: "billing" });
            assertExists(result);
            assertEquals(result.messages.length, 2);
            assertEquals(
              result.messages.every((m) => m.category === "billing"),
              true,
            );
          });

          await t.step("filters by contact_id", async () => {
            const { result } = await callTool<{
              messages: Array<{ contact_id: string }>;
            }>(token, "list_messages", { contact_id: contactB.id });
            assertExists(result);
            assertEquals(result.messages.length, 1);
            assertEquals(result.messages[0].contact_id, contactB.id);
          });

          await t.step("filters by remote_domain", async () => {
            const { result } = await callTool<{
              messages: Array<{ remote_domain: string }>;
            }>(token, "list_messages", { remote_domain: "beta.example" });
            assertExists(result);
            assertEquals(result.messages.length, 1);
            assertEquals(result.messages[0].remote_domain, "beta.example");
          });

          await t.step("filters by unread", async () => {
            const { result } = await callTool<{
              messages: Array<{ read: boolean }>;
            }>(token, "list_messages", { read: false });
            assertExists(result);
            assertEquals(result.messages.length, 3);
            assertEquals(
              result.messages.every((m) => m.read === false),
              true,
            );
          });

          await t.step("messages isolated by owner OID", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result } = await callTool<{
              messages: Array<unknown>;
            }>(otherToken, "list_messages", {});
            assertExists(result);
            assertEquals(result.messages.length, 0);
          });

          await t.step("paginates via resume_token", async () => {
            const { result: p1 } = await callTool<{
              messages: Array<{ id: string }>;
              next_resume_token?: string;
            }>(token, "list_messages", { page_size: 2 });
            assertExists(p1);
            assertEquals(p1.messages.length, 2);
            assertExists(p1.next_resume_token);

            const { result: p2 } = await callTool<{
              messages: Array<{ id: string }>;
              next_resume_token?: string;
            }>(token, "list_messages", {
              page_size: 2,
              resume_token: p1.next_resume_token,
            });
            assertExists(p2);
            assertEquals(p2.messages.length, 1);
            const ids1 = p1.messages.map((m) => m.id);
            const ids2 = p2.messages.map((m) => m.id);
            assertEquals(ids1.filter((id) => ids2.includes(id)).length, 0);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
