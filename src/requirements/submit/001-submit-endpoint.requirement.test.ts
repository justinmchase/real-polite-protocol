import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";

Deno.test({
  name:
    "req:submit-001 - Servers expose an envelope endpoint that accepts message, invitation, and receipt envelopes",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);

      try {
        // Create a test receipt
        const receiptId = crypto.randomUUID();
        const receiptSecret = crypto.randomUUID();
        await kv.set(
          ["receipts", receiptId],
          { id: receiptId, secret: receiptSecret, status: "active" },
        );

        await t.step(
          "POST /rpp/v1/messages accepts a single message envelope",
          async () => {
            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "message",
              sent_at: "2026-04-20T00:00:00Z",
              message: {
                content_rating: "G",
                subject: "Hello",
                body: {
                  content_type: "text/markdown",
                  content: "Hello from RPP.",
                },
              },
            });

            const bodyBytes = new TextEncoder().encode(bodyJson);
            const timestamp = new Date().toISOString();
            const signature = await computeHmac(
              receiptSecret,
              timestamp,
              bodyBytes,
            );

            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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

            const payload = await response.json() as {
              accepted?: boolean;
              message_id?: string;
              ok?: boolean;
            };

            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
            assertExists(payload.message_id);
          },
        );

        await t.step(
          "multiple deliveries require multiple independent submissions",
          async () => {
            const firstJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "message",
              sent_at: "2026-04-20T00:00:01Z",
              message: {
                content_rating: "G",
                subject: "Message one",
                body: {
                  content_type: "text/markdown",
                  content: "First message.",
                },
              },
            });

            const secondJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "message",
              sent_at: "2026-04-20T00:00:02Z",
              message: {
                content_rating: "G",
                subject: "Message two",
                body: {
                  content_type: "text/markdown",
                  content: "Second message.",
                },
              },
            });

            const timestamp = new Date().toISOString();
            const firstBytes = new TextEncoder().encode(firstJson);
            const secondBytes = new TextEncoder().encode(secondJson);
            const firstSignature = await computeHmac(
              receiptSecret,
              timestamp,
              firstBytes,
            );
            const secondSignature = await computeHmac(
              receiptSecret,
              timestamp,
              secondBytes,
            );

            const first = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-receipt-id": receiptId,
                "x-rpp-signature": firstSignature,
                "x-rpp-timestamp": timestamp,
              },
              body: firstJson,
            });

            const second = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-receipt-id": receiptId,
                "x-rpp-signature": secondSignature,
                "x-rpp-timestamp": timestamp,
              },
              body: secondJson,
            });

            assertEquals(first.status, 202);
            assertEquals(second.status, 202);
            await first.text();
            await second.text();
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
