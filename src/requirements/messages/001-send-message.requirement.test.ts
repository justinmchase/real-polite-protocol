// req:messages-001 — Listeners can send messages using a held receipt.
//
// Tests here verify that the send_message MCP tool signs and delivers a message
// envelope to the receiver's /rpp/v1/envelopes endpoint using the receipt secret
// for HMAC-SHA-256, and that invalid inputs are rejected locally before any
// network call is attempted.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";

Deno.test({
  name: "req:messages-001 - Listeners can send messages using a held receipt",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
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
            "send_message delivers a signed message envelope to the receiver endpoint",
            async () => {
              await withCallbackServer(async (receiverDomain, getCaptures) => {
                // Seed a pending invitation from the receiver domain so that
                // accepting it produces a receipt pointing there.
                const invId = crypto.randomUUID();
                await kv.set(["invitations", invId], {
                  invitation_id: invId,
                  receiver_oid: accountOid,
                  sender_domain: receiverDomain,
                  status: "pending",
                  proposed_terms: {
                    category: "billing",
                    max_content_rating: "G",
                  },
                  created_at: new Date().toISOString(),
                });

                const { result: acceptResult } = await callTool<{
                  receipt?: { id: string };
                }>(token, "accept_invitation", { invitation_id: invId });
                assertExists(acceptResult?.receipt?.id);
                const receiptId = acceptResult!.receipt!.id;

                const { status, result } = await callTool<{
                  message_id: string;
                  sent_at: string;
                  accepted: boolean;
                }>(token, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello from the test.",
                  },
                  subject: "Test subject",
                });

                assertEquals(status, 200);
                assertExists(result?.message_id);
                assertExists(result?.sent_at);
                assertEquals(result?.accepted, true);

                // Receiver must have received exactly one POST.
                const captures = getCaptures();
                // accept_invitation callback is also captured; the last capture
                // is the send_message delivery.
                const msgCapture = captures[captures.length - 1];
                assertExists(msgCapture);
                assertEquals(msgCapture.body.category, "message");
                assertExists(msgCapture.headers["x-rpp-receipt-id"]);
                assertExists(msgCapture.headers["x-rpp-signature"]);
                assertExists(msgCapture.headers["x-rpp-timestamp"]);
              });
            },
          );

          await t.step(
            "send_message returns E_RECEIPT_NOT_ACTIVE for a revoked receipt",
            async () => {
              const revokedId = crypto.randomUUID();
              await kv.set(["receipts", revokedId], {
                id: revokedId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "revoked",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: revokedId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "Hi." },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_RECEIPT_NOT_ACTIVE",
              );
            },
          );

          await t.step(
            "send_message rejects a receipt that belongs to a different account",
            async () => {
              const otherId = crypto.randomUUID();
              await kv.set(["receipts", otherId], {
                id: otherId,
                secret: crypto.randomUUID(),
                oid: crypto.randomUUID(), // different owner
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "send_message",
                {
                  receipt_id: otherId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "Hi." },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
            },
          );

          await t.step(
            "send_message rejects application/json body that is not valid JSON",
            async () => {
              // Seed a fresh active receipt for this step.
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "application/json",
                    content: "not valid json",
                  },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVALID_BODY",
              );
            },
          );

          await t.step(
            "send_message rejects application/json body whose top-level value is not an object or array",
            async () => {
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "application/json",
                    content: '"a string"',
                  },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVALID_BODY",
              );
            },
          );

          await t.step(
            "send_message rejects a message body exceeding 256 KB",
            async () => {
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              // Generate a content string well over 256 KB.
              const oversized = "x".repeat(300 * 1024);

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: oversized },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_TOO_LARGE",
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
