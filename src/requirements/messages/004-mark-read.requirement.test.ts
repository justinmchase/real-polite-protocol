import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

Deno.test({
  name: "req:messages-004 - Listeners can mark messages as read",
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

          const unknownId = crypto.randomUUID();

          await t.step("marks unread messages as read", async () => {
            const { status, result } = await callTool<{
              marked: string[];
              already_read: string[];
              not_found: string[];
            }>(token, "mark_read", { message_ids: [m1, m2, unknownId] });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.marked.sort(), [m1, m2].sort());
            assertEquals(result.already_read, []);
            assertEquals(result.not_found, [unknownId]);
          });

          await t.step(
            "sets read=true and read_at on the records",
            async () => {
              const { result } = await callTool<{
                read: boolean;
                read_at?: string;
              }>(token, "get_message", { message_id: m1 });
              assertExists(result);
              assertEquals(result.read, true);
              assertExists(result.read_at);
            },
          );

          await t.step("second call reports already_read", async () => {
            const { result } = await callTool<{
              marked: string[];
              already_read: string[];
              not_found: string[];
            }>(token, "mark_read", { message_ids: [m1, m2] });
            assertExists(result);
            assertEquals(result.marked, []);
            assertEquals(result.already_read.sort(), [m1, m2].sort());
          });

          await t.step(
            "messages of other accounts treated as not_found",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result } = await callTool<{
                marked: string[];
                already_read: string[];
                not_found: string[];
              }>(otherToken, "mark_read", { message_ids: [m1] });
              assertExists(result);
              assertEquals(result.marked, []);
              assertEquals(result.already_read, []);
              assertEquals(result.not_found, [m1]);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
