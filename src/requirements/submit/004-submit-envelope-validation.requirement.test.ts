import { assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import { submitReceiptCallback } from "../helpers/submit-receipt-callback.ts";

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
  name:
    "req:submit-004 - Envelope requests are validated against the kind-specific schema before acceptance",
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

        await t.step("Rejects requests with invalid JSON body", async () => {
          const timestamp = new Date().toISOString();
          const bodyBytes = new TextEncoder().encode("not valid json");
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
            message: {
              content_rating: "G",
              subject: "Test",
              body: { content_type: "text/markdown", content: "Hello" },
            },
          };
          const bodyJson = JSON.stringify(message);
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step(
          "Rejects requests with missing sender_domain",
          async () => {
            const message = {
              message_id: crypto.randomUUID(),
              category: "message",
              sent_at: "2026-04-20T00:00:00Z",
              message: {
                content_rating: "G",
                subject: "Test",
                body: { content_type: "text/markdown", content: "Hello" },
              },
            };
            const bodyJson = JSON.stringify(message);
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        await t.step("Rejects requests with missing category", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            sent_at: "2026-04-20T00:00:00Z",
            message: {
              content_rating: "G",
              subject: "Test",
              body: { content_type: "text/markdown", content: "Hello" },
            },
          };
          const bodyJson = JSON.stringify(message);
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step("Rejects requests with missing sent_at", async () => {
          const message = {
            message_id: crypto.randomUUID(),
            sender_domain: "sender.example",
            category: "message",
            message: {
              content_rating: "G",
              subject: "Test",
              body: { content_type: "text/markdown", content: "Hello" },
            },
          };
          const bodyJson = JSON.stringify(message);
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

          assertEquals(response.status, 400);
          const payload = await response.json();
          assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
        });

        await t.step(
          "Rejects invitation envelope missing the invitation block",
          async () => {
            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "invitation",
              sent_at: "2026-04-20T00:00:00Z",
              // invitation block intentionally omitted
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        await t.step(
          "Rejects invitation envelope missing both receptive_policy_id and receipt_id",
          async () => {
            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "invitation",
              sent_at: "2026-04-20T00:00:00Z",
              invitation: {
                // neither receptive_policy_id nor receipt_id provided
                invitation_id: crypto.randomUUID(),
                proposed_terms: { category: "billing" },
                delivery: {
                  domain: "sender.example",
                  token: crypto.randomUUID(),
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        await t.step(
          "Rejects invitation envelope with both receptive_policy_id and receipt_id",
          async () => {
            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "invitation",
              sent_at: "2026-04-20T00:00:00Z",
              invitation: {
                // both receptive_policy_id and receipt_id provided — only one is allowed
                invitation_id: crypto.randomUUID(),
                receptive_policy_id: crypto.randomUUID(),
                receipt_id: crypto.randomUUID(),
                proposed_terms: { category: "billing" },
                delivery: {
                  domain: "sender.example",
                  token: crypto.randomUUID(),
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        await t.step(
          "Rejects invitation envelope missing the delivery block",
          async () => {
            const policyId = crypto.randomUUID();
            await kv.set(["receptive_policies", policyId], {
              policy_id: policyId,
              oid: crypto.randomUUID(),
              mode: "all",
              status: "active",
              created_at: new Date(),
            });

            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "invitation",
              sent_at: "2026-04-20T00:00:00Z",
              invitation: {
                invitation_id: crypto.randomUUID(),
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
                // delivery block intentionally omitted
              },
            });
            const timestamp = new Date().toISOString();

            // Policy-based invitation: no auth headers needed
            const response = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-timestamp": timestamp,
              },
              body: bodyJson,
            });

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        // ---------------------------------------------------------------
        // Receipt envelope validation
        // ---------------------------------------------------------------

        await t.step(
          "Rejects receipt envelope missing invitation_id",
          async () => {
            const invitationId = crypto.randomUUID();
            const deliveryToken = crypto.randomUUID();
            await kv.set(["invitations", invitationId], {
              invitation_id: invitationId,
              status: "pending",
              delivery: { domain: "partner.example", token: deliveryToken },
              created_at: new Date().toISOString(),
            });

            const bodyJson = JSON.stringify({
              category: "receipt",
              // invitation_id intentionally omitted
              decision: "accepted",
              receipt: {
                id: crypto.randomUUID(),
                secret: crypto.randomUUID(),
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                issued_at: new Date().toISOString(),
              },
            });
            const bodyBytes = new TextEncoder().encode(bodyJson);
            const timestamp = new Date().toISOString();
            const signature = await computeHmac(
              deliveryToken,
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
            const payload = await response.json();
            assertEquals(payload.code, "E_RECEIPT_ENVELOPE_INVALID");
          },
        );

        await t.step(
          "Rejects receipt envelope with decision=accepted but no receipt object",
          async () => {
            const invitationId = crypto.randomUUID();
            const deliveryToken = crypto.randomUUID();
            await kv.set(["invitations", invitationId], {
              invitation_id: invitationId,
              status: "pending",
              delivery: { domain: "partner.example", token: deliveryToken },
              created_at: new Date().toISOString(),
            });

            const response = await submitReceiptCallback({
              invitationId,
              deliveryToken,
              decision: "accepted",
              // receipt intentionally omitted
              baseUrl,
            });

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_RECEIPT_ENVELOPE_INVALID");
          },
        );

        await t.step(
          "Rejects receipt envelope with decision=rejected but receipt object present",
          async () => {
            const invitationId = crypto.randomUUID();
            const deliveryToken = crypto.randomUUID();
            await kv.set(["invitations", invitationId], {
              invitation_id: invitationId,
              status: "pending",
              delivery: { domain: "partner.example", token: deliveryToken },
              created_at: new Date().toISOString(),
            });

            const response = await submitReceiptCallback({
              invitationId,
              deliveryToken,
              decision: "rejected",
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_RECEIPT_ENVELOPE_INVALID");
          },
        );

        await t.step(
          "Rejects message envelope missing the message block",
          async () => {
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_MESSAGE_ENVELOPE");
          },
        );

        await t.step(
          "Rejects message envelope with invalid body content_type",
          async () => {
            const message = {
              ...validMessageEnvelope,
              message_id: crypto.randomUUID(),
              message: {
                ...validMessageEnvelope.message,
                body: { content_type: "text/html", content: "Hello" },
              },
            };
            const bodyJson = JSON.stringify(message);
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_CONTENT_TYPE");
          },
        );

        await t.step(
          "Rejects application/json message body with malformed JSON content",
          async () => {
            const message = {
              ...validMessageEnvelope,
              message_id: crypto.randomUUID(),
              message: {
                ...validMessageEnvelope.message,
                body: { content_type: "application/json", content: "not json {{{" },
              },
            };
            const bodyJson = JSON.stringify(message);
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

            assertEquals(response.status, 400);
            const payload = await response.json();
            assertEquals(payload.code, "E_INVALID_BODY");
          },
        );

        await t.step("Rejects requests exceeding 256 KB", async () => {
          // Create a message that when JSON-encoded exceeds 256 KB
          const largeContent = "x".repeat(262_145);
          const message = {
            ...validMessageEnvelope,
            message: {
              ...validMessageEnvelope.message,
              body: {
                content_type: "text/markdown" as const,
                content: largeContent,
              },
            },
          };
          const bodyJson = JSON.stringify(message);
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
        });
      } finally {
        kv.close();
      }
    });
  },
});
