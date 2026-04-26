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
        } finally {
          kv.close();
        }
      });
    });
  },
});
