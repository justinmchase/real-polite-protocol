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
  name: "req:messages-003 - Listeners can retrieve a single message by ID",
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
          const messageId = crypto.randomUUID();
          const resp = await submitMessageEnvelope({
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
            messageId,
            subject: "Single",
            baseUrl,
          });
          assertEquals(resp.status, 202);
          await resp.body?.cancel();

          await t.step("returns full envelope plus server fields", async () => {
            const { status, result } = await callTool<{
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
            }>(token, "get_message", { message_id: messageId });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.message_id, messageId);
            assertEquals(result.contact_id, contact.id);
            assertEquals(result.remote_domain, contact.remote_domain);
            assertEquals(result.message.subject, "Single");
            assertEquals(result.read, false);
            assertExists(result.sender_fields);
          });

          await t.step(
            "unknown message returns E_MESSAGE_NOT_FOUND",
            async () => {
              const { result } = await callTool<ToolError>(
                token,
                "get_message",
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
            "message owned by another account is hidden",
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
                "get_message",
                { message_id: messageId },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
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
