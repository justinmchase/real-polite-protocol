import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name:
    "req:messages-007 - Message metadata is preserved and returned verbatim",
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

          // Submit one message with metadata and one without.
          const idWith = crypto.randomUUID();
          const metadata = {
            thread_id: "t-123",
            count: 7,
            flagged: true,
            tags: ["alpha", "beta"],
          };
          const r1 = await submitMessageEnvelope({
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
            messageId: idWith,
            metadata,
            baseUrl,
          });
          assertEquals(r1.status, 202);
          await r1.body?.cancel();

          const idWithout = crypto.randomUUID();
          const r2 = await submitMessageEnvelope({
            credential: contact.local_credential,
            senderDomain: contact.remote_domain,
            messageId: idWithout,
            baseUrl,
          });
          assertEquals(r2.status, 202);
          await r2.body?.cancel();

          await t.step("get_message returns metadata verbatim", async () => {
            const { result } = await callTool<{ metadata?: unknown }>(
              token,
              "get_message",
              { message_id: idWith },
            );
            assertExists(result);
            assertEquals(result.metadata, metadata);
          });

          await t.step(
            "get_message omits metadata when not stored",
            async () => {
              const { result } = await callTool<Record<string, unknown>>(
                token,
                "get_message",
                { message_id: idWithout },
              );
              assertExists(result);
              assertEquals("metadata" in result, false);
            },
          );

          await t.step(
            "list_messages returns metadata when present",
            async () => {
              const { result } = await callTool<{
                messages: Array<Record<string, unknown>>;
              }>(token, "list_messages", {});
              assertExists(result);
              const m = result.messages.find((x) => x.message_id === idWith);
              assertExists(m);
              assertEquals(m.metadata, metadata);
              const m2 = result.messages.find((x) =>
                x.message_id === idWithout
              );
              assertExists(m2);
              assertEquals("metadata" in m2, false);
            },
          );

          await t.step(
            "envelope with nested-object metadata is rejected",
            async () => {
              const r = await submitMessageEnvelope({
                credential: contact.local_credential,
                senderDomain: contact.remote_domain,
                metadata: { bad: { nested: "x" } } as unknown as Record<
                  string,
                  unknown
                >,
                baseUrl,
              });
              assertEquals(r.status, 400);
              await r.body?.cancel();
            },
          );

          await t.step(
            "send_message surfaces metadata validation as tool error",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const { result, body } = await callTool(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "x" },
                    metadata: { bad: { nested: 1 } },
                  },
                );
                // Either the tool result is an error wrapper or MCP returned a
                // JSON-RPC error response. Either way, no outbound HTTP request
                // MUST have been made before the validation error surfaced.
                const errorish =
                  (result as { ok?: boolean } | undefined)?.ok ===
                    false ||
                  body.error !== undefined ||
                  result === undefined;
                assertEquals(errorish, true);
                assertEquals(getCaptures().length, 0);
              });
            },
          );

          await t.step(
            "send_message includes metadata in outbound envelope",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const sentMetadata = { thread_id: "abc" };
                const { result } = await callTool<{ accepted: boolean }>(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "x" },
                    metadata: sentMetadata,
                  },
                );
                assertExists(result);
                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const env = calls[0].body as { metadata?: unknown };
                assertEquals(env.metadata, sentMetadata);
              });
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
