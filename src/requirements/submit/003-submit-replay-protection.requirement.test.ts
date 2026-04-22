import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";

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
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function submitMessage(
  opts: {
    receiptId: string;
    receiptSecret: string;
    messageId: string;
    timestamp?: string;
  },
): Promise<Response> {
  const bodyJson = JSON.stringify({
    message_id: opts.messageId,
    sender_domain: "sender.example",
    category: "message",
    sent_at: "2026-04-20T00:00:00Z",
    message: {
      content_rating: "G",
      subject: "Replay test",
      body: { content_type: "text/markdown", content: "Hello." },
    },
  });
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(opts.receiptSecret, timestamp, bodyBytes);

  return await fetch("http://localhost:8000/rpp/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rpp-receipt-id": opts.receiptId,
      "x-rpp-signature": signature,
      "x-rpp-timestamp": timestamp,
    },
    body: bodyJson,
  });
}

Deno.test({
  name: "req:submit-003 - Submit requests are protected against replay",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath }) => {
      const kv = await Deno.openKv(kvPath);
      const receiptId = crypto.randomUUID();
      const receiptSecret = crypto.randomUUID();

      try {
        await kv.set(["receipts", receiptId], {
          id: receiptId,
          secret: receiptSecret,
          status: "active",
        });
      } finally {
        kv.close();
      }

      await t.step(
        "a stale timestamp (> 60 seconds old) is rejected with REQUEST_STALE",
        async () => {
          const staleTime = new Date(Date.now() - 90_000).toISOString(); // 90 seconds ago
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: staleTime,
          });
          assertEquals(response.status, 400);
          const body = await response.json() as { code?: string };
          assertEquals(body.code, "E_REQUEST_STALE");
        },
      );

      await t.step(
        "a future timestamp (> 60 seconds ahead) is rejected with REQUEST_STALE",
        async () => {
          const futureTime = new Date(Date.now() + 90_000).toISOString(); // 90 seconds in future
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: futureTime,
          });
          assertEquals(response.status, 400);
          const body = await response.json() as { code?: string };
          assertEquals(body.code, "E_REQUEST_STALE");
        },
      );

      await t.step(
        "a fresh request is accepted",
        async () => {
          const messageId = crypto.randomUUID();
          const response = await submitMessage({ receiptId, receiptSecret, messageId });
          assertEquals(response.status, 202);
          const body = await response.json() as { ok?: boolean; accepted?: boolean; message_id?: string };
          assertEquals(body.ok, true);
          assertEquals(body.accepted, true);
          assertExists(body.message_id);
        },
      );

      await t.step(
        "replaying the same message_id is rejected with DUPLICATE_MESSAGE",
        async () => {
          const messageId = crypto.randomUUID();

          // First submission succeeds.
          const first = await submitMessage({ receiptId, receiptSecret, messageId });
          assertEquals(first.status, 202);
          await first.body?.cancel();

          // Duplicate submission is rejected.
          const second = await submitMessage({ receiptId, receiptSecret, messageId });
          assertEquals(second.status, 400);
          const body = await second.json() as { code?: string };
          assertEquals(body.code, "E_DUPLICATE_MESSAGE");
        },
      );
    });
  },
});
