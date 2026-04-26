// req:messages-004 — Listeners can mark messages as read.
//
// Tests verify idempotency, ownership enforcement, and correct bucketing of
// message_ids into marked / already_read / not_found.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedMessage } from "../helpers/seed-message.ts";

Deno.test({
  name: "req:messages-004 - Listeners can mark messages as read",
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

          const messageId1 = await seedMessage({
            kv,
            callTool,
            baseUrl,
            accountOid,
            token,
          });
          const messageId2 = await seedMessage({
            kv,
            callTool,
            baseUrl,
            accountOid,
            token,
          });

          await t.step(
            "mark_read transitions unread messages and returns them in marked",
            async () => {
              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(token, "mark_read", {
                message_ids: [messageId1, messageId2],
              });

              assertExists(result);
              assertEquals(
                result.marked.sort(),
                [messageId1, messageId2].sort(),
              );
              assertEquals(result.already_read, []);
              assertEquals(result.not_found, []);
            },
          );

          await t.step(
            "mark_read is idempotent: already-read messages go into already_read",
            async () => {
              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(token, "mark_read", {
                message_ids: [messageId1],
              });

              assertExists(result);
              assertEquals(result.marked, []);
              assertEquals(result.already_read, [messageId1]);
              assertEquals(result.not_found, []);
            },
          );

          await t.step(
            "read_at is set on newly-marked messages and not updated for already-read",
            async () => {
              const messageId3 = await seedMessage({
                kv,
                callTool,
                baseUrl,
                accountOid,
                token,
              });

              // First call — should set read_at
              await callTool(token, "mark_read", {
                message_ids: [messageId3],
              });
              const { result: first } = await callTool<{ read_at?: string }>(
                token,
                "get_message",
                { message_id: messageId3 },
              );
              assertExists(first?.read_at);
              const firstReadAt = first!.read_at!;

              // Wait a tick so wall-clock time could advance, then call again
              await new Promise((r) => setTimeout(r, 5));

              await callTool(token, "mark_read", {
                message_ids: [messageId3],
              });
              const { result: second } = await callTool<{ read_at?: string }>(
                token,
                "get_message",
                { message_id: messageId3 },
              );
              assertEquals(second?.read_at, firstReadAt);
            },
          );

          await t.step(
            "mark_read returns unknown message_id in not_found",
            async () => {
              const unknownId = crypto.randomUUID();
              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(token, "mark_read", { message_ids: [unknownId] });

              assertExists(result);
              assertEquals(result.marked, []);
              assertEquals(result.already_read, []);
              assertEquals(result.not_found, [unknownId]);
            },
          );

          await t.step(
            "mark_read silently ignores messages owned by a different account",
            async () => {
              // Create a second account with its own message
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

              // Caller tries to mark the other account's message
              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(token, "mark_read", { message_ids: [otherMessageId] });

              assertExists(result);
              // Must be in not_found, never in marked or already_read
              assertEquals(result.marked, []);
              assertEquals(result.already_read, []);
              assertEquals(result.not_found, [otherMessageId]);
            },
          );

          await t.step(
            "mark_read handles mixed owned/unowned/unknown in one call",
            async () => {
              const messageId4 = await seedMessage({
                kv,
                callTool,
                baseUrl,
                accountOid,
                token,
              });
              const unknownId = crypto.randomUUID();

              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(token, "mark_read", {
                // messageId1 is already read, messageId4 is unread, unknownId doesn't exist
                message_ids: [messageId1, messageId4, unknownId],
              });

              assertExists(result);
              assertEquals(result.marked, [messageId4]);
              assertEquals(result.already_read, [messageId1]);
              assertEquals(result.not_found, [unknownId]);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
