// req:messages-001 — Listeners can send messages to a known contact via send_message.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";
import { withFailingRemoteServer } from "../helpers/with-failing-remote-server.ts";
import { seedContact } from "../helpers/seed-contact.ts";

interface ToolError {
  ok?: boolean;
  error?: { code?: string };
}

Deno.test({
  name: "req:messages-001 - Listeners can send messages to a known contact",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "send_message HMAC-signs the envelope and POSTs to remote /rpp/v1/envelopes",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const contact = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const { status, result } = await callTool<
                  { message_id: string; sent_at: string; accepted: boolean }
                >(token, "send_message", {
                  contact_id: contact.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello.",
                  },
                  subject: "Hi",
                });
                assertEquals(status, 200);
                assertExists(result?.message_id);
                assertExists(result?.sent_at);
                assertEquals(result?.accepted, true);

                const captures = getCaptures();
                assertEquals(captures.length, 1);
                const cap = captures[0]!;
                assertEquals(cap.method, "POST");
                assertEquals(
                  cap.url.endsWith("/rpp/v1/envelopes"),
                  true,
                );
                const cb = cap.body as Record<string, unknown>;
                assertEquals(cb.category, "correspondence");
                assertEquals(
                  String(cb.sender_domain).startsWith("localhost"),
                  true,
                );
                assertEquals(cb.subject, "Hi");
                assertEquals(
                  cap.headers["x-rpp-contact-id"],
                  contact.remote_credential.contact_id,
                );
                assertExists(cap.headers["x-rpp-signature"]);
                assertExists(cap.headers["x-rpp-timestamp"]);
              });
            },
          );

          await t.step(
            "send_message rejects an unknown contact_id with E_CONTACT_NOT_FOUND",
            async () => {
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: crypto.randomUUID(),
                  category: "correspondence",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_CONTACT_NOT_FOUND",
              );
            },
          );

          await t.step(
            "send_message rejects a contact owned by a different account",
            async () => {
              const otherOid = crypto.randomUUID();
              const stranger = await seedContact(kv, {
                ownerOid: otherOid,
                remoteDomain: "stranger.example",
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: stranger.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_CONTACT_NOT_FOUND",
              );
            },
          );

          await t.step(
            "send_message rejects a blocked contact with E_CONTACT_NOT_READY",
            async () => {
              const blocked = await seedContact(kv, {
                ownerOid,
                remoteDomain: "blocked.example",
                blocked: true,
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: blocked.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_CONTACT_NOT_READY",
              );
            },
          );

          await t.step(
            "send_message enforces remote_terms.categories with E_CATEGORY_NOT_PERMITTED",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                remoteDomain: "narrow.example",
                remoteTerms: {
                  categories: ["billing"],
                  max_content_rating: "PG",
                },
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: c.id,
                  category: "marketing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_CATEGORY_NOT_PERMITTED",
              );
            },
          );

          await t.step(
            "send_message enforces remote_terms.max_content_rating",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                remoteDomain: "kids.example",
                remoteTerms: {
                  categories: ["correspondence"],
                  max_content_rating: "G",
                },
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: c.id,
                  category: "correspondence",
                  content_rating: "R",
                  body: { content_type: "text/markdown", content: "hi" },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_CONTENT_RATING_NOT_PERMITTED",
              );
            },
          );

          await t.step(
            "send_message rejects malformed application/json body with E_INVALID_BODY",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                remoteDomain: "json.example",
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: c.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: {
                    content_type: "application/json",
                    content: "not valid json",
                  },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals((result as ToolError).error?.code, "E_INVALID_BODY");
            },
          );

          await t.step(
            "send_message rejects envelope > 256 KB with E_ENVELOPE_TOO_LARGE",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                remoteDomain: "big.example",
              });
              const { result } = await callTool<ToolError>(
                token,
                "send_message",
                {
                  contact_id: c.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: {
                    content_type: "text/markdown",
                    content: "x".repeat(262_145),
                  },
                },
              );
              assertEquals((result as ToolError).ok, false);
              assertEquals(
                (result as ToolError).error?.code,
                "E_ENVELOPE_TOO_LARGE",
              );
            },
          );

          await t.step(
            "send_message surfaces remote delivery failure as E_DELIVERY_FAILED",
            async () => {
              await withFailingRemoteServer(500, async (remoteDomain) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const { result } = await callTool<ToolError>(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "hi" },
                  },
                );
                assertEquals((result as ToolError).ok, false);
                assertEquals(
                  (result as ToolError).error?.code,
                  "E_DELIVERY_FAILED",
                );
              });
            },
          );

          await t.step(
            "send_message generates a UUIDv7 message_id unique across calls",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const send = () =>
                  callTool<{ message_id: string }>(token, "send_message", {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "ping" },
                  });
                const { result: r1 } = await send();
                const { result: r2 } = await send();
                const id1 = r1?.message_id ?? "";
                const id2 = r2?.message_id ?? "";
                assertExists(id1);
                assertExists(id2);
                // UUIDv7 version nibble is the 15th character (index 14).
                assertEquals(id1[14], "7", id1);
                assertEquals(id2[14], "7", id2);
                assertEquals(id1 === id2, false);
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
