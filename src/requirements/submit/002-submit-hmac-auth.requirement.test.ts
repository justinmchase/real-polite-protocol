import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import { submitReceiptCallback } from "../helpers/submit-receipt-callback.ts";

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

Deno.test({
  name:
    "req:submit-002 - Envelope requests are authenticated with HMAC signatures keyed by envelope kind",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);

      try {
        // Create a test receipt for message-envelope auth tests.
        const receiptId = crypto.randomUUID();
        const receiptSecret = crypto.randomUUID();
        await kv.set(
          ["receipts", receiptId],
          { id: receiptId, secret: receiptSecret, status: "active" },
        );

        const bodyJson = JSON.stringify(testMessage);
        const bodyBytes = new TextEncoder().encode(bodyJson);
        const timestamp = new Date().toISOString();

        await t.step(
          "Rejects message envelope with missing x-rpp-receipt-id header",
          async () => {
            const signature = await computeHmac(
              receiptSecret,
              timestamp,
              bodyBytes,
            );

            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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
            assertEquals(payload.code, "E_MISSING_RECEIPT_ID");
          },
        );

        await t.step(
          "Rejects requests with missing x-rpp-signature header",
          async () => {
            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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
            assertEquals(payload.code, "E_MISSING_SIGNATURE");
          },
        );

        await t.step(
          "Rejects requests with missing x-rpp-timestamp header",
          async () => {
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
              },
              body: bodyJson,
            });

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_MISSING_TIMESTAMP");
          },
        );

        await t.step("Rejects requests with unknown receipt ID", async () => {
          const unknownReceiptId = crypto.randomUUID();
          const signature = await computeHmac(
            receiptSecret,
            timestamp,
            bodyBytes,
          );

          const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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
          assertEquals(payload.code, "E_RECEIPT_NOT_FOUND");
        });

        await t.step(
          "Rejects requests with invalid HMAC signature",
          async () => {
            const invalidSignature = "0".repeat(64);

            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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
            assertEquals(payload.code, "E_RECEIPT_INVALID_SIGNATURE");
          },
        );

        await t.step(
          "Rejects requests that carry both x-rpp-receipt-id and x-rpp-invitation-id (E_INVALID_AUTH_HEADERS)",
          async () => {
            const invitationId = crypto.randomUUID();
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
                "x-rpp-invitation-id": invitationId,
                "x-rpp-signature": signature,
                "x-rpp-timestamp": timestamp,
              },
              body: bodyJson,
            });

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_AUTH_HEADERS");
          },
        );

        await t.step(
          "Accepts message envelope with valid receipt and HMAC signature",
          async () => {
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
            const payload = await response.json();
            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
            assertExists(payload.message_id);
          },
        );

        await t.step(
          "Accepts receipt envelope signed with x-rpp-invitation-id and delivery token",
          async () => {
            // Seed a local invitation as it would be stored when the sender sent it
            // and is now waiting for the receipt callback.
            const invitationId = crypto.randomUUID();
            const deliveryToken = crypto.randomUUID();
            await kv.set(["invitations", invitationId], {
              invitation_id: invitationId,
              receiver_oid: crypto.randomUUID(),
              sender_domain: "partner.example",
              status: "pending",
              delivery: {
                domain: "partner.example",
                token: deliveryToken,
              },
              proposed_terms: { category: "billing" },
              created_at: new Date().toISOString(),
            });

            const response = await submitReceiptCallback({
              invitationId,
              deliveryToken,
              decision: "accepted",
              receipt: {
                id: crypto.randomUUID(),
                secret: crypto.randomUUID(),
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                issued_at: new Date().toISOString(),
              },
              baseUrl,
            });

            assertEquals(response.status, 202);
            const payload = await response.json();
            assertEquals(payload.ok, true);
            assertEquals(payload.accepted, true);
          },
        );

        await t.step(
          "rejects message envelope with x-rpp-invitation-id header (wrong kind) with E_INVALID_AUTH_HEADERS",
          async () => {
            // Sending only x-rpp-invitation-id (no x-rpp-receipt-id) on a
            // message envelope is a header-kind mismatch and must be rejected.
            const invitationId = crypto.randomUUID();
            const signature = await computeHmac(
              receiptSecret,
              timestamp,
              bodyBytes,
            );

            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-invitation-id": invitationId,
                "x-rpp-signature": signature,
                "x-rpp-timestamp": timestamp,
              },
              body: bodyJson,
            });

            assertEquals(response.status, 400);
            const body = await response.json();
            assertEquals(body.code, "E_INVALID_AUTH_HEADERS");
          },
        );

        await t.step(
          "envelope authentication failures return HTTP 403 not HTTP 401",
          async () => {
            // Credential-based failures (wrong HMAC) must use 403 Forbidden,
            // never 401 Unauthorized (which would require a WWW-Authenticate header
            // and a different auth flow).
            const invalidSignature = "f".repeat(64);

            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
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
            assertNotEquals(
              response.status,
              401,
              "envelope endpoint must use 403, not 401, for credential failures",
            );
            const body = await response.json();
            assertEquals(body.code, "E_RECEIPT_INVALID_SIGNATURE");
          },
        );
      } finally {
        kv.close();
      }
    });
  },
});
