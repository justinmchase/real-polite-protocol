import { assertEquals } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";

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

const validMessageEnvelope = {
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

Deno.test({
  name: "req:submit-004 - Submit requests validate the base message envelope before acceptance",
  fn: async (t) => {
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

        await t.step("Rejects requests with invalid JSON body", async () => {
          const timestamp = new Date().toISOString();
          const bodyBytes = new TextEncoder().encode("not valid json");
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);

          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
            },
            body: bodyBytes,
          });

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_REQUEST_BODY");
        });

        await t.step("Rejects requests with missing message_id", async () => {
          const message = {
            sender_domain: "sender.example",
            category: "message",
            sent_at: "2026-04-20T00:00:00Z",
            message: { content_rating: "G", subject: "Test", body: { content_type: "text/markdown", content: "Hello" } },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects requests with missing sender_domain", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            category: "message",
            sent_at: "2026-04-20T00:00:00Z",
            message: { content_rating: "G", subject: "Test", body: { content_type: "text/markdown", content: "Hello" } },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects requests with missing category", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            sent_at: "2026-04-20T00:00:00Z",
            message: { content_rating: "G", subject: "Test", body: { content_type: "text/markdown", content: "Hello" } },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects requests with missing sent_at", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            category: "message",
            message: { content_rating: "G", subject: "Test", body: { content_type: "text/markdown", content: "Hello" } },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects invitation envelope missing the invitation block", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            category: "invitation",
            sent_at: "2026-04-20T00:00:00Z",
            // invitation block intentionally omitted
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects invitation envelope missing receptive_policy_id", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            category: "invitation",
            sent_at: "2026-04-20T00:00:00Z",
            invitation: {
              // receptive_policy_id intentionally omitted
              proposed_terms: {},
            },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects message envelope missing the message block", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            category: "message",
            sent_at: "2026-04-20T00:00:00Z",
            // message block intentionally omitted
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects message envelope with invalid body content_type", async () => {
          const message = {
            ...validMessageEnvelope,
            message: {
              ...validMessageEnvelope.message,
              body: { content_type: "application/json", content: "Hello" },
            },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects requests exceeding 256 KB", async () => {
          // Create a message that when JSON-encoded exceeds 256 KB
          const largeContent = "x".repeat(262_145);
          const message = {
            ...validMessageEnvelope,
            message: {
              ...validMessageEnvelope.message,
              body: { content_type: "text/markdown" as const, content: largeContent },
            },
          };
          const bodyJson = JSON.stringify(message);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
          const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);

          const response = await fetch("http://localhost:8000/rpp/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-rpp-receipt-id": receiptId,
              "x-rpp-signature": signature,
              "x-rpp-timestamp": timestamp,
              "content-length": bodyBytes.length.toString(),
            },
            body: bodyJson,
          });

          assertEquals(response.status, 413);
          const payload = await response.json();
          assertEquals(payload.code, "E_MESSAGE_TOO_LARGE");
        });

        await t.step("Accepts valid message envelope", async () => {
          const bodyJson = JSON.stringify(validMessageEnvelope);
          const bodyBytes = new TextEncoder().encode(bodyJson);
          const timestamp = new Date().toISOString();
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
        });
      } finally {
        kv.close();
      }
    });
  },
});
