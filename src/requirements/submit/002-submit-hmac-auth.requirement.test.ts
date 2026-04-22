import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";

const testMessage = {
  message_id: crypto.randomUUID(),
  sender_domain: "sender.example",
  category: "message",
  sent_at: "2026-04-20T00:00:00Z",
  message: {
    content_rating: "G",
    subject: "Test",
    body: { content_type: "text/markdown", content: "Hello" },
  },
};

async function computeHmac(
  receiptSecret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const key = new TextEncoder().encode(receiptSecret);
  const data = new TextEncoder().encode(`${timestamp}.`);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  
  const combined = new Uint8Array(data.length + bodyBytes.length);
  combined.set(data, 0);
  combined.set(bodyBytes, data.length);
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test({
  name: "req:submit-002 - Submit requests are authenticated with receipt-based HMAC signatures",
  ignore: true,
  fn: async (t) => {
    // TODO: implement after invitations system exists to issue test receipts
    await withStartedServer(async ({ kvPath }) => {
      const kv = await Deno.openKv(kvPath);
      
      try {
        // Create a test receipt
        const receiptId = crypto.randomUUID();
        const receiptSecret = crypto.randomUUID();
        await kv.set(
          ["receipts", receiptId],
          { id: receiptId, secret: receiptSecret, status: "active" },
        );

        const bodyJson = JSON.stringify(testMessage);
        const bodyBytes = new TextEncoder().encode(bodyJson);
        const timestamp = new Date().toISOString();

        await t.step("Rejects requests with missing x-rpp-receipt-id header", async () => {
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);
          
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.error.code, "MISSING_RECEIPT_ID");
        });

        await t.step("Rejects requests with missing x-rpp-signature header", async () => {
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.error.code, "MISSING_SIGNATURE");
        });

        await t.step("Rejects requests with missing x-rpp-timestamp header", async () => {
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);
          
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-signature": signature,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.error.code, "MISSING_TIMESTAMP");
        });

        await t.step("Rejects requests with unknown receipt ID", async () => {
          const unknownReceiptId = crypto.randomUUID();
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);
          
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": unknownReceiptId,
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 403);
          const payload = await response.json();
          assertEquals(payload.error.code, "RECEIPT_NOT_FOUND");
        });

        await t.step("Rejects requests with invalid signature", async () => {
          const invalidSignature = "0".repeat(64);
          
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-signature": invalidSignature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 403);
          const payload = await response.json();
          assertEquals(payload.error.code, "RECEIPT_INVALID_SIGNATURE");
        });

        await t.step("Accepts requests with valid receipt and signature", async () => {
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);
          
          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyJson,
          });
          
          assertEquals(response.status, 202);
          const payload = await response.json();
          assertEquals(payload.ok, true);
          assertEquals(payload.accepted, true);
          assertExists(payload.message_id);
        });
      } finally {
        kv.close();
      }
    });
  },
});
