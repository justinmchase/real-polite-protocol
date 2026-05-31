import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import type { ToolError } from "../helpers/call-tool.ts";

Deno.test({
  name: "req:messages-005 - Listeners can delete a message",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          const contact = await seedContact(kv, { ownerOid });
          const m1 = crypto.randomUUID();
          const m2 = crypto.randomUUID();
          for (const id of [m1, m2]) {
            const r = await submitMessageEnvelope({
              credential: contact.local_credential,
              senderDomain: contact.remote_domain,
              messageId: id,
              baseUrl,
            });
            assertEquals(r.status, 202);
            await r.body?.cancel();
          }

          await t.step("delete_message returns confirmation", async () => {
            const { status, result } = await callTool<{
              message_id: string;
              deleted: true;
            }>(token, "delete_message", { message_id: m1 });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.message_id, m1);
            assertEquals(result.deleted, true);
          });

          await t.step(
            "deleted message hidden from get_message",
            async () => {
              const { result } = await callTool<ToolError>(
                token,
                "get_message",
                { message_id: m1 },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step(
            "deleted message hidden from list_messages",
            async () => {
              const { result } = await callTool<{
                messages: Array<{ message_id: string }>;
              }>(token, "list_messages", {});
              assertExists(result);
              const ids = result.messages.map((m) => m.message_id);
              assertEquals(ids.includes(m1), false);
              assertEquals(ids.includes(m2), true);
            },
          );

          await t.step(
            "unknown message returns E_MESSAGE_NOT_FOUND",
            async () => {
              const { result } = await callTool<ToolError>(
                token,
                "delete_message",
                { message_id: crypto.randomUUID() },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step(
            "message owned by another account hidden",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result } = await callTool<ToolError>(
                otherToken,
                "delete_message",
                { message_id: m2 },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_MESSAGE_NOT_FOUND",
              );
            },
          );

          await t.step("contact still exists after deletion", async () => {
            const { result } = await callTool<{ id: string }>(
              token,
              "get_contact",
              { contact_id: contact.id },
            );
            assertExists(result);
            assertEquals(result.id, contact.id);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
