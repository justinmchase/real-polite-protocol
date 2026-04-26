// req:messages-003 — Listeners can retrieve a single message by ID.
//
// Tests verify that get_message returns the full stored record for messages
// owned by the caller, and returns a structured not-found error for unknown
// or foreign messages.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { submitMessage } from "../helpers/submit-message.ts";

Deno.test({
  name: "req:messages-003 - Listeners can retrieve a single message by ID",
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

          // Seed an invitation and accept it to obtain a receipt.
          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { category: "billing", max_content_rating: "G" },
            created_at: new Date().toISOString(),
          });
          const { result: acceptResult } = await callTool<{
            receipt?: { id: string; secret: string };
          }>(token, "accept_invitation", { invitation_id: invId });
          assertExists(acceptResult?.receipt?.id);
          const receiptId = acceptResult!.receipt!.id;
          const receiptSecret = acceptResult!.receipt!.secret;

          // Submit a message using the receipt.
          const messageId = crypto.randomUUID();
          const submitResp = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            senderDomain: "sender.example",
            baseUrl,
          });
          assertEquals(submitResp.status, 202);
          await submitResp.body?.cancel();

          await t.step(
            "get_message returns the full stored record for a message the caller received",
            async () => {
              const { status, result } = await callTool<{
                message_id: string;
                sender_domain: string;
                category: string;
                sent_at: string;
                received_at: string;
                read: boolean;
                message: {
                  content_rating: string;
                  subject: string;
                  body: { content_type: string; content: string };
                };
              }>(token, "get_message", { message_id: messageId });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.message_id, messageId);
              assertEquals(result.sender_domain, "sender.example");
              assertEquals(result.category, "billing");
              assertExists(result.sent_at);
              assertExists(result.received_at);
              assertEquals(typeof result.read, "boolean");
              assertExists(result.message?.body?.content_type);
            },
          );

          await t.step(
            "get_message returns E_MESSAGE_NOT_FOUND for an unknown message_id",
            async () => {
              const { result } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "get_message", {
                message_id: crypto.randomUUID(),
              });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step(
            "get_message returns E_MESSAGE_NOT_FOUND for a message owned by a different account",
            async () => {
              // Create a second account and submit a message to it.
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other User",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const otherInvId = crypto.randomUUID();
              await kv.set(["invitations", otherInvId], {
                invitation_id: otherInvId,
                receiver_oid: otherOid,
                sender_domain: "sender.example",
                status: "pending",
                proposed_terms: {
                  category: "billing",
                  max_content_rating: "G",
                },
                created_at: new Date().toISOString(),
              });
              const { result: otherAccept } = await callTool<{
                receipt?: { id: string; secret: string };
              }>(otherToken, "accept_invitation", {
                invitation_id: otherInvId,
              });
              assertExists(otherAccept?.receipt?.id);
              const otherReceiptId = otherAccept!.receipt!.id;
              const otherReceiptSecret = otherAccept!.receipt!.secret;

              const otherMessageId = crypto.randomUUID();
              const otherSubmit = await submitMessage({
                receiptId: otherReceiptId,
                receiptSecret: otherReceiptSecret,
                messageId: otherMessageId,
                senderDomain: "sender.example",
                baseUrl,
              });
              assertEquals(otherSubmit.status, 202);
              await otherSubmit.body?.cancel();

              // Caller (accountOid) must NOT see the other account's message.
              const { result } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "get_message", { message_id: otherMessageId });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
