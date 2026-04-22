import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

async function computeHmac(
  receiptSecret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const key = new TextEncoder().encode(receiptSecret);
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function submitMessage(
  receiptId: string,
  receiptSecret: string,
): Promise<Response> {
  const bodyJson = JSON.stringify({
    message_id: crypto.randomUUID(),
    sender_domain: "sender.example",
    category: "message",
    sent_at: new Date().toISOString(),
    message: {
      content_rating: "G",
      subject: "Revocation test",
      body: { content_type: "text/markdown", content: "Hello." },
    },
  });
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = new Date().toISOString();
  const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);

  return await fetch("http://localhost:8000/rpp/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rpp-receipt-id": receiptId,
      "x-rpp-signature": signature,
      "x-rpp-timestamp": timestamp,
    },
    body: bodyJson,
  });
}

Deno.test({
  name: "req:receipts-003 - Listeners can revoke an issued receipt",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          await callTool(token, "set_user_verified_metadata");

          const invitationId = crypto.randomUUID();
          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { categories: ["billing"] },
            created_at: new Date().toISOString(),
          });

          const { result: acceptResult } = await callTool<{
            receipt?: { id: string; secret: string };
          }>(token, "accept_invitation", { invitation_id: invitationId });
          const receiptId = acceptResult?.receipt?.id;
          const receiptSecret = acceptResult?.receipt?.secret;
          assertExists(receiptId);
          assertExists(receiptSecret);

          await t.step("revoke_receipt sets status to revoked", async () => {
            const { status, result } = await callTool<{
              status: string;
              revoked_at?: string;
              revocation_reason?: string;
            }>(token, "revoke_receipt", {
              receipt_id: receiptId,
              reason: "SENDER_REQUEST",
              reason_detail: "No longer accepting messages from this sender",
            });

            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.status, "revoked");
            assertExists(result.revoked_at);
            assertEquals(result.revocation_reason, "SENDER_REQUEST");
          });

          await t.step("revoked receipt appears as revoked in list_issued_receipts", async () => {
            const { result } = await callTool<{
              receipts: Array<{ id: string; status: string }>;
            }>(token, "list_issued_receipts", { status: "revoked" });

            assertExists(result);
            const found = result.receipts.find((r) => r.id === receiptId);
            assertExists(found);
            assertEquals(found.status, "revoked");
          });

          await t.step("submit with revoked receipt returns E_RECEIPT_REVOKED", async () => {
            const response = await submitMessage(receiptId, receiptSecret);
            assertEquals(response.status, 403);
            const body = await response.json() as { code?: string };
            assertEquals(body.code, "E_RECEIPT_REVOKED");
          });

          await t.step("revoking an already-revoked receipt returns E_RECEIPT_ALREADY_REVOKED", async () => {
            const { result } = await callTool<{ ok?: boolean; error?: { code?: string } }>(
              token,
              "revoke_receipt",
              { receipt_id: receiptId, reason: "SPAM" },
            );
            assertExists(result);
            // isError: true tool result — error code in result.error
            assertEquals((result as { ok?: boolean })?.ok, false);
          });

          await t.step("revoking another account's receipt returns E_RECEIPT_NOT_OWNED", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other User",
            });
            await callTool(otherToken, "set_user_verified_metadata");

            // Seed a fresh active receipt owned by original account
            const freshInvitationId = crypto.randomUUID();
            await kv.set(["invitations", freshInvitationId], {
              invitation_id: freshInvitationId,
              receiver_oid: accountOid,
              sender_domain: "sender2.example",
              status: "pending",
              proposed_terms: { categories: ["billing"] },
              created_at: new Date().toISOString(),
            });
            const { result: freshAccept } = await callTool<{
              receipt?: { id: string };
            }>(token, "accept_invitation", { invitation_id: freshInvitationId });
            const freshReceiptId = freshAccept?.receipt?.id;
            assertExists(freshReceiptId);

            const { result } = await callTool<{ ok?: boolean }>(
              otherToken,
              "revoke_receipt",
              { receipt_id: freshReceiptId, reason: "SPAM" },
            );
            assertExists(result);
            assertEquals(result?.ok, false);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
