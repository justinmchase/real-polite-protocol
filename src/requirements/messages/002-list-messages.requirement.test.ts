import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { submitMessage } from "../helpers/submit-message.ts";

Deno.test({
  name: "req:messages-002 - Listeners can list messages in their inbox",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          await callTool(token, "set_user_verified_metadata");

          // Seed invitations from two different senders with different categories
          const invitationIdA = crypto.randomUUID();
          const invitationIdB = crypto.randomUUID();

          await kv.set(["invitations", invitationIdA], {
            invitation_id: invitationIdA,
            receiver_oid: accountOid,
            sender_domain: "alpha.example",
            status: "pending",
            proposed_terms: { category: "billing", max_content_rating: "G" },
            created_at: new Date().toISOString(),
          });
          await kv.set(["invitations", invitationIdB], {
            invitation_id: invitationIdB,
            receiver_oid: accountOid,
            sender_domain: "beta.example",
            status: "pending",
            proposed_terms: {
              category: "correspondence",
              max_content_rating: "G",
            },
            created_at: new Date().toISOString(),
          });

          // Accept both invitations to issue receipts
          const { result: resultA } = await callTool<{
            receipt?: { id: string; secret: string };
          }>(token, "accept_invitation", { invitation_id: invitationIdA });
          const { result: resultB } = await callTool<{
            receipt?: { id: string; secret: string };
          }>(token, "accept_invitation", { invitation_id: invitationIdB });

          const receiptIdA = resultA?.receipt?.id;
          const receiptSecretA = resultA?.receipt?.secret;
          const receiptIdB = resultB?.receipt?.id;
          const receiptSecretB = resultB?.receipt?.secret;

          assertExists(receiptIdA);
          assertExists(receiptSecretA);
          assertExists(receiptIdB);
          assertExists(receiptSecretB);

          // Submit two messages via receipt A and one via receipt B
          const submitA1 = await submitMessage({
            receiptId: receiptIdA,
            receiptSecret: receiptSecretA,
            senderDomain: "alpha.example",
            baseUrl,
          });
          assertEquals(submitA1.status, 202);
          await submitA1.body?.cancel();

          const submitA2 = await submitMessage({
            receiptId: receiptIdA,
            receiptSecret: receiptSecretA,
            senderDomain: "alpha.example",
            baseUrl,
          });
          assertEquals(submitA2.status, 202);
          await submitA2.body?.cancel();

          const submitB1 = await submitMessage({
            receiptId: receiptIdB,
            receiptSecret: receiptSecretB,
            senderDomain: "beta.example",
            baseUrl,
          });
          assertEquals(submitB1.status, 202);
          await submitB1.body?.cancel();

          await t.step(
            "list_messages returns all received messages for caller",
            async () => {
              const { status, result } = await callTool<{
                messages: Array<{
                  id: string;
                  sender_domain: string;
                  category: string;
                  received_at: string;
                }>;
                page_size: number;
              }>(token, "list_messages", {});

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.messages.length, 3);
              assertEquals(typeof result.page_size, "number");
            },
          );

          await t.step(
            "list_messages results are ordered by received_at descending",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ received_at: string }>;
              }>(token, "list_messages", {});

              assertExists(result);
              const timestamps = result.messages.map((m) =>
                new Date(m.received_at).getTime()
              );
              for (let i = 1; i < timestamps.length; i++) {
                assertEquals(
                  timestamps[i - 1] >= timestamps[i],
                  true,
                  `Message at index ${i - 1} should be newer than index ${i}`,
                );
              }
            },
          );

          await t.step(
            "list_messages filters by category",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ category: string }>;
              }>(token, "list_messages", { category: "billing" });

              assertExists(result);
              assertEquals(result.messages.length, 2);
              assertEquals(
                result.messages.every((m) => m.category === "billing"),
                true,
              );
            },
          );

          await t.step(
            "list_messages filters by sender_domain",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ sender_domain: string }>;
              }>(token, "list_messages", { sender_domain: "beta.example" });

              assertExists(result);
              assertEquals(result.messages.length, 1);
              assertEquals(result.messages[0].sender_domain, "beta.example");
            },
          );

          await t.step(
            "list_messages filters by read status (unread only)",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ read: boolean }>;
              }>(token, "list_messages", { read: false });

              assertExists(result);
              assertEquals(result.messages.length, 3);
              assertEquals(
                result.messages.every((m) => m.read === false),
                true,
              );
            },
          );

          await t.step(
            "messages from other accounts are not visible",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other User",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const { result } = await callTool<{
                messages: Array<{ id: string }>;
              }>(otherToken, "list_messages", {});

              assertExists(result);
              assertEquals(result.messages.length, 0);
            },
          );

          await t.step(
            "list_messages returns next_resume_token when more pages exist",
            async () => {
              const { result } = await callTool<{
                messages: Array<unknown>;
                next_resume_token?: string;
              }>(token, "list_messages", { page_size: 2 });

              assertExists(result);
              assertEquals(result.messages.length, 2);
              assertExists(result.next_resume_token);
            },
          );

          await t.step(
            "list_messages resumes from next_resume_token",
            async () => {
              const { result: page1 } = await callTool<{
                messages: Array<{ id: string }>;
                next_resume_token?: string;
              }>(token, "list_messages", { page_size: 2 });

              assertExists(page1);
              assertExists(page1.next_resume_token);

              const { result: page2 } = await callTool<{
                messages: Array<{ id: string }>;
                next_resume_token?: string;
              }>(token, "list_messages", {
                page_size: 2,
                resume_token: page1.next_resume_token,
              });

              assertExists(page2);
              assertEquals(page2.messages.length, 1);

              // No overlap between pages
              const idsPage1 = page1.messages.map((m) => m.id);
              const idsPage2 = page2.messages.map((m) => m.id);
              const overlap = idsPage1.filter((id) => idsPage2.includes(id));
              assertEquals(overlap.length, 0);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
