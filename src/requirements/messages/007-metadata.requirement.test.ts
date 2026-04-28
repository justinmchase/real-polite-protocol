// req:messages-007 — Message metadata is preserved and returned verbatim.
//
// Tests verify that metadata attached to an inbound message envelope is stored
// and returned unchanged by get_message and list_messages, that envelopes
// without metadata do not include the field in responses, and that invalid
// metadata values are rejected with E_INVALID_MESSAGE_ENVELOPE.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { submitMessage } from "../helpers/submit-message.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";

// Helper: seeds an invitation and accepts it to obtain a receipt.
async function setupReceipt(
  kv: Deno.Kv,
  callTool: (
    token: string,
    tool: string,
    params?: unknown,
  ) => Promise<{ status: number; result: unknown }>,
  token: string,
  accountOid: string,
): Promise<{ receiptId: string; receiptSecret: string }> {
  const invId = crypto.randomUUID();
  await kv.set(["invitations", invId], {
    invitation_id: invId,
    receiver_oid: accountOid,
    sender_domain: "sender.example",
    status: "pending",
    proposed_terms: { category: "billing", max_content_rating: "G" },
    created_at: new Date().toISOString(),
  });
  const { result } = await callTool(token, "accept_invitation", {
    invitation_id: invId,
  });
  const typed = result as { receipt?: { id: string; secret: string } };
  assertExists(typed?.receipt?.id);
  return {
    receiptId: typed.receipt!.id,
    receiptSecret: typed.receipt!.secret,
  };
}

Deno.test({
  name:
    "req:messages-007 - Message metadata is preserved and returned verbatim",
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

          await t.step(
            "metadata is stored and returned by get_message",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const messageId = crypto.randomUUID();
              const resp = await submitMessage({
                receiptId,
                receiptSecret,
                messageId,
                senderDomain: "sender.example",
                baseUrl,
                metadata: { "in_reply_to": "abc-123", "thread_index": 2 },
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();

              const { status, result } = await callTool<{
                message_id: string;
                metadata?: Record<string, unknown>;
              }>(token, "get_message", { message_id: messageId });

              assertEquals(status, 200);
              assertExists(result?.metadata);
              assertEquals(result!.metadata!["in_reply_to"], "abc-123");
              assertEquals(result!.metadata!["thread_index"], 2);
            },
          );

          await t.step(
            "metadata is returned by list_messages",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const messageId = crypto.randomUUID();
              const resp = await submitMessage({
                receiptId,
                receiptSecret,
                messageId,
                senderDomain: "sender.example",
                baseUrl,
                metadata: { "rpp.threading.in_reply_to": "xyz-789" },
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();

              const { status, result } = await callTool<{
                messages: Array<{
                  message_id: string;
                  metadata?: Record<string, unknown>;
                }>;
              }>(token, "list_messages");

              assertEquals(status, 200);
              const msg = result?.messages?.find(
                (m) => m.message_id === messageId,
              );
              assertExists(msg);
              assertExists(msg!.metadata);
              assertEquals(
                msg!.metadata!["rpp.threading.in_reply_to"],
                "xyz-789",
              );
            },
          );

          await t.step(
            "message without metadata does not include metadata field",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const messageId = crypto.randomUUID();
              const resp = await submitMessage({
                receiptId,
                receiptSecret,
                messageId,
                senderDomain: "sender.example",
                baseUrl,
                // no metadata
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();

              const { status, result } = await callTool<{
                message_id: string;
                metadata?: unknown;
              }>(token, "get_message", { message_id: messageId });

              assertEquals(status, 200);
              // metadata should be absent (not null or {})
              assertEquals(result?.metadata, undefined);
            },
          );

          await t.step(
            "submit endpoint rejects metadata with nested objects (E_INVALID_MESSAGE_ENVELOPE)",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const bodyJson = JSON.stringify({
                message_id: crypto.randomUUID(),
                sender_domain: "sender.example",
                category: "message",
                sent_at: "2026-04-20T00:00:00Z",
                message: {
                  content_rating: "G",
                  subject: "Test",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello.",
                  },
                },
                metadata: { "nested": { "not": "allowed" } },
              });
              const bodyBytes = new TextEncoder().encode(bodyJson);
              const timestamp = new Date().toISOString();
              const signature = await computeHmac(
                receiptSecret,
                timestamp,
                bodyBytes,
              );

              const resp = await fetch(
                `${baseUrl}/rpp/v1/envelopes`,
                {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-rpp-receipt-id": receiptId,
                    "x-rpp-signature": signature,
                    "x-rpp-timestamp": timestamp,
                  },
                  body: bodyJson,
                },
              );
              assertEquals(resp.status, 400);
              const body = await resp.json() as { code?: string };
              assertEquals(body.code, "E_INVALID_MESSAGE_ENVELOPE");
            },
          );

          await t.step(
            "submit endpoint rejects metadata exceeding 20 keys (E_INVALID_MESSAGE_ENVELOPE)",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const tooManyKeys = Object.fromEntries(
                Array.from({ length: 21 }, (_, i) => [`key${i}`, "value"]),
              );

              const bodyJson = JSON.stringify({
                message_id: crypto.randomUUID(),
                sender_domain: "sender.example",
                category: "message",
                sent_at: "2026-04-20T00:00:00Z",
                message: {
                  content_rating: "G",
                  subject: "Test",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello.",
                  },
                },
                metadata: tooManyKeys,
              });
              const bodyBytes = new TextEncoder().encode(bodyJson);
              const timestamp = new Date().toISOString();
              const signature = await computeHmac(
                receiptSecret,
                timestamp,
                bodyBytes,
              );

              const resp = await fetch(
                `${baseUrl}/rpp/v1/envelopes`,
                {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-rpp-receipt-id": receiptId,
                    "x-rpp-signature": signature,
                    "x-rpp-timestamp": timestamp,
                  },
                  body: bodyJson,
                },
              );
              assertEquals(resp.status, 400);
              const body = await resp.json() as { code?: string };
              assertEquals(body.code, "E_INVALID_MESSAGE_ENVELOPE");
            },
          );

          await t.step(
            "submit endpoint rejects metadata with a string value exceeding 512 chars",
            async () => {
              const { receiptId, receiptSecret } = await setupReceipt(
                kv,
                callTool as (
                  t: string,
                  tool: string,
                  p?: unknown,
                ) => Promise<{ status: number; result: unknown }>,
                token,
                accountOid,
              );

              const bodyJson = JSON.stringify({
                message_id: crypto.randomUUID(),
                sender_domain: "sender.example",
                category: "message",
                sent_at: "2026-04-20T00:00:00Z",
                message: {
                  content_rating: "G",
                  subject: "Test",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello.",
                  },
                },
                metadata: { "key": "x".repeat(513) },
              });
              const bodyBytes = new TextEncoder().encode(bodyJson);
              const timestamp = new Date().toISOString();
              const signature = await computeHmac(
                receiptSecret,
                timestamp,
                bodyBytes,
              );

              const resp = await fetch(
                `${baseUrl}/rpp/v1/envelopes`,
                {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-rpp-receipt-id": receiptId,
                    "x-rpp-signature": signature,
                    "x-rpp-timestamp": timestamp,
                  },
                  body: bodyJson,
                },
              );
              assertEquals(resp.status, 400);
              const body = await resp.json() as { code?: string };
              assertEquals(body.code, "E_INVALID_MESSAGE_ENVELOPE");
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
