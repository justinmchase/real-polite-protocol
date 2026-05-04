// req:messages-008 — Listeners can list messages they have sent (outbox).
//
// Tests here verify that the send_message MCP tool stores an outbox record
// for every send attempt and that list_sent_messages returns those records with
// correct field values and filter/pagination behavior.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";

Deno.test({
  name: "req:messages-008 - Listeners can list messages they have sent",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test Sender",
          });

          await callTool(token, "set_user_verified_metadata");

          await withCallbackServer(async (receiverDomainA, _capturesA) => {
            await withCallbackServer(async (receiverDomainB, _capturesB) => {
              // Seed invitations so we can accept them to get receipts
              const invIdA = crypto.randomUUID();
              const invIdB = crypto.randomUUID();

              await kv.set(["invitations", invIdA], {
                invitation_id: invIdA,
                receiver_oid: accountOid,
                sender_domain: receiverDomainA,
                status: "pending",
                proposed_terms: {
                  category: "billing",
                  max_content_rating: "G",
                },
                created_at: new Date().toISOString(),
              });
              await kv.set(["invitations", invIdB], {
                invitation_id: invIdB,
                receiver_oid: accountOid,
                sender_domain: receiverDomainB,
                status: "pending",
                proposed_terms: {
                  category: "correspondence",
                  max_content_rating: "G",
                },
                created_at: new Date().toISOString(),
              });

              // Accept both to issue receipts (held by the sender)
              const { result: resultA } = await callTool<{
                receipt?: { id: string };
              }>(token, "accept_invitation", { invitation_id: invIdA });
              const { result: resultB } = await callTool<{
                receipt?: { id: string };
              }>(token, "accept_invitation", { invitation_id: invIdB });

              assertExists(resultA?.receipt?.id);
              assertExists(resultB?.receipt?.id);
              const receiptIdA = resultA!.receipt!.id;
              const receiptIdB = resultB!.receipt!.id;

              // Send two messages via receipt A and one via receipt B
              const { status: s1, result: r1 } = await callTool<{
                message_id: string;
                sent_at: string;
              }>(token, "send_message", {
                receipt_id: receiptIdA,
                category: "billing",
                content_rating: "G",
                subject: "Invoice 1",
                body: {
                  content_type: "text/markdown",
                  content: "# Invoice 1",
                },
              });
              assertEquals(s1, 200);
              assertExists(r1?.message_id);

              const { status: s2 } = await callTool(token, "send_message", {
                receipt_id: receiptIdA,
                category: "billing",
                content_rating: "G",
                subject: "Invoice 2",
                body: {
                  content_type: "text/markdown",
                  content: "# Invoice 2",
                },
              });
              assertEquals(s2, 200);

              const { status: s3 } = await callTool(token, "send_message", {
                receipt_id: receiptIdB,
                category: "correspondence",
                content_rating: "G",
                subject: "Hello",
                body: {
                  content_type: "text/markdown",
                  content: "Hello there",
                },
              });
              assertEquals(s3, 200);

              await t.step(
                "list_sent_messages returns all sent messages for caller",
                async () => {
                  const { status, result } = await callTool<{
                    messages: Array<{
                      message_id: string;
                      receiver_domain: string;
                      category: string;
                      sent_at: string;
                      status: string;
                    }>;
                    page_size: number;
                  }>(token, "list_sent_messages", {});

                  assertEquals(status, 200);
                  assertExists(result);
                  assertEquals(result.messages.length, 3);
                  assertEquals(typeof result.page_size, "number");
                },
              );

              await t.step(
                "list_sent_messages results are ordered by sent_at descending",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{ sent_at: string }>;
                  }>(token, "list_sent_messages", {});

                  assertExists(result);
                  const ts = result.messages.map((m) =>
                    new Date(m.sent_at).getTime()
                  );
                  for (let i = 1; i < ts.length; i++) {
                    assertEquals(
                      ts[i - 1] >= ts[i],
                      true,
                      `Message at index ${
                        i - 1
                      } should be newer than index ${i}`,
                    );
                  }
                },
              );

              await t.step(
                "each outbox record includes required fields",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{
                      message_id: string;
                      receipt_id: string;
                      receiver_domain: string;
                      category: string;
                      content_rating: string;
                      sent_at: string;
                      status: string;
                      body: { content_type: string; content: string };
                    }>;
                  }>(token, "list_sent_messages", {});

                  assertExists(result);
                  for (const msg of result.messages) {
                    assertExists(msg.message_id);
                    assertExists(msg.receipt_id);
                    assertExists(msg.receiver_domain);
                    assertExists(msg.category);
                    assertExists(msg.content_rating);
                    assertExists(msg.sent_at);
                    assertExists(msg.status);
                    assertExists(msg.body?.content_type);
                  }
                },
              );

              await t.step(
                "outbox records have status=delivered on successful send",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{ status: string }>;
                  }>(token, "list_sent_messages", {});

                  assertExists(result);
                  assertEquals(
                    result.messages.every((m) => m.status === "delivered"),
                    true,
                  );
                },
              );

              await t.step(
                "list_sent_messages filters by category",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{ category: string }>;
                  }>(token, "list_sent_messages", { category: "billing" });

                  assertExists(result);
                  assertEquals(result.messages.length, 2);
                  assertEquals(
                    result.messages.every((m) => m.category === "billing"),
                    true,
                  );
                },
              );

              await t.step(
                "list_sent_messages filters by receiver_domain",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{ receiver_domain: string }>;
                  }>(token, "list_sent_messages", {
                    receiver_domain: receiverDomainB,
                  });

                  assertExists(result);
                  assertEquals(result.messages.length, 1);
                  assertEquals(
                    result.messages[0].receiver_domain,
                    receiverDomainB,
                  );
                },
              );

              await t.step(
                "list_sent_messages filters by status",
                async () => {
                  const { result } = await callTool<{
                    messages: Array<{ status: string }>;
                  }>(token, "list_sent_messages", { status: "delivered" });

                  assertExists(result);
                  assertEquals(result.messages.length, 3);
                  assertEquals(
                    result.messages.every((m) => m.status === "delivered"),
                    true,
                  );
                },
              );

              await t.step(
                "list_sent_messages does not return messages from other accounts",
                async () => {
                  // A different account should see zero sent messages
                  const otherOid = crypto.randomUUID();
                  const otherToken = await issueToken({
                    oid: otherOid,
                    scope: requiredScopes.join(" "),
                    name: "Other User",
                  });

                  const { result } = await callTool<{
                    messages: unknown[];
                  }>(otherToken, "list_sent_messages", {});

                  assertExists(result);
                  assertEquals(result.messages.length, 0);
                },
              );
            });
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
