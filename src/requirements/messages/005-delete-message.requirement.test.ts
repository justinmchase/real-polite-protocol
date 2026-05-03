import { submitMessage } from "../helpers/submit-message.ts";

// req:messages-005 — Listeners can delete a message from their local store.
//
// Tests verify that delete_message removes the record atomically, enforces
// ownership, and returns structured errors for unknown / foreign messages.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedMessage } from "../helpers/seed-message.ts";

Deno.test({
  name:
    "req:messages-005 - Listeners can delete a message from their local store",
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

          const messageId = await seedMessage({
            kv,
            callTool,
            baseUrl,
            accountOid,
            token,
          });

          await t.step(
            "delete_message returns confirmation with message_id and deleted: true",
            async () => {
              const { result } = await callTool<{
                message_id: string;
                deleted: boolean;
              }>(token, "delete_message", { message_id: messageId });

              assertExists(result);
              assertEquals(result.message_id, messageId);
              assertEquals(result.deleted, true);
            },
          );

          await t.step(
            "deleted message is no longer returned by get_message",
            async () => {
              const { result } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "get_message", { message_id: messageId });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step(
            "deleted message does not appear in list_messages",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ message_id: string }>;
              }>(token, "list_messages");

              assertExists(result);
              const ids = result.messages.map((m) => m.message_id);
              assertEquals(ids.includes(messageId), false);
            },
          );

          await t.step(
            "delete_message returns E_MESSAGE_NOT_FOUND for an unknown message_id",
            async () => {
              const { result } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "delete_message", {
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
            "delete_message returns E_MESSAGE_NOT_FOUND for a message owned by a different account",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other User",
              });
              await callTool(otherToken, "set_user_verified_metadata");

              const otherMessageId = await seedMessage({
                kv,
                callTool,
                baseUrl,
                accountOid: otherOid,
                token: otherToken,
              });

              const { result } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "delete_message", { message_id: otherMessageId });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_NOT_FOUND",
              );

              // Confirm the message still exists for the actual owner
              const { result: ownerResult } = await callTool<{
                message_id?: string;
              }>(otherToken, "get_message", { message_id: otherMessageId });
              assertEquals(ownerResult?.message_id, otherMessageId);
            },
          );

          await t.step(
            "delete_message is idempotent in the sense that a second call returns not-found",
            async () => {
              const msgId = await seedMessage({
                kv,
                callTool,
                baseUrl,
                accountOid,
                token,
              });

              // First delete — succeeds
              const { result: first } = await callTool<{
                deleted?: boolean;
              }>(token, "delete_message", { message_id: msgId });
              assertEquals(first?.deleted, true);

              // Second delete — not-found
              const { result: second } = await callTool<{
                ok?: boolean;
                error?: { code?: string };
              }>(token, "delete_message", { message_id: msgId });
              assertEquals((second as { ok?: boolean })?.ok, false);
              assertEquals(
                (second as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step(
            "deleted message does not appear in list_messages under any filter combination",
            async () => {
              const filteredMsgId = await seedMessage({
                kv,
                callTool,
                baseUrl,
                accountOid,
                token,
                senderDomain: "filtered-sender.example",
              });

              // Delete the message.
              await callTool(token, "delete_message", {
                message_id: filteredMsgId,
              });

              // Must be absent from unfiltered list.
              const { result: noFilter } = await callTool<{
                messages: Array<{ message_id: string }>;
              }>(token, "list_messages");
              assertExists(noFilter);
              assertEquals(
                noFilter.messages.map((m) => m.message_id).includes(
                  filteredMsgId,
                ),
                false,
                "deleted message must not appear in unfiltered list_messages",
              );

              // Must be absent when filtering by category.
              const { result: byCat } = await callTool<{
                messages: Array<{ message_id: string }>;
              }>(token, "list_messages", { category: "billing" });
              assertExists(byCat);
              assertEquals(
                byCat.messages.map((m) => m.message_id).includes(
                  filteredMsgId,
                ),
                false,
                "deleted message must not appear in category-filtered list_messages",
              );

              // Must be absent when filtering by sender_domain.
              const { result: byDomain } = await callTool<{
                messages: Array<{ message_id: string }>;
              }>(token, "list_messages", {
                sender_domain: "filtered-sender.example",
              });
              assertExists(byDomain);
              assertEquals(
                byDomain.messages.map((m) => m.message_id).includes(
                  filteredMsgId,
                ),
                false,
                "deleted message must not appear in sender_domain-filtered list_messages",
              );
            },
          );

          await t.step(
            "delete_message does not revoke the receipt referenced by the deleted message",
            async () => {
              // Manually drive the invitation → acceptance → message flow so
              // we can capture the receipt id.
              const invId = crypto.randomUUID();
              const senderDomainForReceipt = "receipt-check-sender.example";
              await kv.set(["invitations", invId], {
                invitation_id: invId,
                receiver_oid: accountOid,
                sender_domain: senderDomainForReceipt,
                status: "pending",
                proposed_terms: {
                  category: "billing",
                  max_content_rating: "G",
                },
                created_at: new Date().toISOString(),
              });

              const { result: acceptResult } = await callTool<{
                receipt?: { id: string; secret: string };
              }>(token, "accept_invitation", { invitation_id: invId });
              const receiptId = acceptResult?.receipt?.id;
              const receiptSecret = acceptResult?.receipt?.secret;
              assertExists(receiptId, "receipt must be issued on acceptance");
              assertExists(receiptSecret);

              // Submit a message with the receipt.
              const msgIdForReceipt = crypto.randomUUID();
              const submitResp = await submitMessage({
                receiptId: receiptId!,
                receiptSecret: receiptSecret!,
                messageId: msgIdForReceipt,
                senderDomain: senderDomainForReceipt,
                baseUrl,
              });
              assertEquals(submitResp.status, 202);
              await submitResp.body?.cancel();

              // Delete the message.
              const { result: delResult } = await callTool<{
                deleted?: boolean;
              }>(token, "delete_message", { message_id: msgIdForReceipt });
              assertEquals(delResult?.deleted, true);

              // The receipt must still be active in list_issued_receipts.
              const { result: receipts } = await callTool<{
                receipts: Array<{ id: string; status: string }>;
              }>(token, "list_issued_receipts");
              assertExists(receipts);
              const foundReceipt = receipts.receipts.find(
                (r) => r.id === receiptId,
              );
              assertExists(
                foundReceipt,
                "receipt must still appear in list_issued_receipts after message deletion",
              );
              assertEquals(
                foundReceipt.status,
                "active",
                "receipt must remain active after message deletion",
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
