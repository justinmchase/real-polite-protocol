import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { submitMessage } from "../helpers/submit-message.ts";
import { submitReceiptCallback } from "../helpers/submit-receipt-callback.ts";

Deno.test({
  name: "req:submit-003 - Envelope requests are protected against replay",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
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
        "a stale timestamp (> 60 seconds old) is rejected with E_REQUEST_STALE",
        async () => {
          const staleTime = new Date(Date.now() - 90_000).toISOString(); // 90 seconds ago
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: staleTime,
            baseUrl,
          });
          assertEquals(response.status, 400);
          const body = await response.json() as { code?: string };
          assertEquals(body.code, "E_REQUEST_STALE");
        },
      );

      await t.step(
        "a future timestamp (> 60 seconds ahead) is rejected with E_REQUEST_STALE",
        async () => {
          const futureTime = new Date(Date.now() + 90_000).toISOString(); // 90 seconds in future
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: futureTime,
            baseUrl,
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
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(response.status, 202);
          const body = await response.json() as {
            ok?: boolean;
            accepted?: boolean;
            message_id?: string;
          };
          assertEquals(body.ok, true);
          assertEquals(body.accepted, true);
          assertExists(body.message_id);
        },
      );

      await t.step(
        "replaying the same message_id is rejected with E_DUPLICATE_MESSAGE",
        async () => {
          const messageId = crypto.randomUUID();

          // First submission succeeds.
          const first = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(first.status, 202);
          await first.body?.cancel();

          // Duplicate submission is rejected.
          const second = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(second.status, 400);
          const body = await second.json() as { code?: string };
          assertEquals(body.code, "E_DUPLICATE_MESSAGE");
        },
      );

      await t.step(
        "duplicate invitation envelope (same sender_domain + invitation_id) is rejected with E_DUPLICATE_MESSAGE",
        async () => {
          const kv = await Deno.openKv(kvPath);
          const policyId = crypto.randomUUID();
          const accountOid = crypto.randomUUID();
          await kv.set(["receptive_policies", policyId], {
            policy_id: policyId,
            oid: accountOid,
            mode: "all",
            status: "active",
            created_at: new Date(),
          });
          kv.close();

          const invitationId = crypto.randomUUID();
          const buildInvitation = () =>
            JSON.stringify({
              message_id: crypto.randomUUID(), // each request gets a fresh message_id
              sender_domain: "sender.example",
              category: "invitation",
              sent_at: new Date().toISOString(),
              invitation: {
                invitation_id: invitationId,
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
                delivery: {
                  domain: "sender.example",
                  token: crypto.randomUUID(),
                },
              },
            });

          // First delivery succeeds.
          const firstBody = buildInvitation();
          const first = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: firstBody,
          });
          assertEquals(first.status, 202);
          await first.body?.cancel();

          // Duplicate (same invitation_id) is rejected.
          const secondBody = buildInvitation();
          const second = await fetch(`${baseUrl}/rpp/v1/envelopes`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: secondBody,
          });
          assertEquals(second.status, 400);
          const body = await second.json() as { code?: string };
          assertEquals(body.code, "E_DUPLICATE_MESSAGE");
        },
      );

      await t.step(
        "duplicate receipt callback for the same invitation_id is rejected with E_INVITATION_NOT_PENDING",
        async () => {
          const kv = await Deno.openKv(kvPath);
          const invitationId = crypto.randomUUID();
          const deliveryToken = crypto.randomUUID();
          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: crypto.randomUUID(),
            sender_domain: "partner.example",
            status: "pending",
            delivery: { domain: "partner.example", token: deliveryToken },
            proposed_terms: { category: "billing" },
            created_at: new Date().toISOString(),
          });
          kv.close();

          const callbackOpts = {
            invitationId,
            deliveryToken,
            decision: "accepted" as const,
            receipt: {
              id: crypto.randomUUID(),
              secret: crypto.randomUUID(),
              category: "billing",
              max_content_rating: "G",
              usage_policy: "any-time",
              issued_at: new Date().toISOString(),
            },
            baseUrl,
          };

          // First callback transitions invitation to accepted.
          const first = await submitReceiptCallback(callbackOpts);
          assertEquals(first.status, 202);
          await first.body?.cancel();

          // Second callback for the same invitation is rejected.
          const second = await submitReceiptCallback(callbackOpts);
          assertEquals(second.status, 400);
          const body = await second.json() as { code?: string };
          assertEquals(body.code, "E_INVITATION_NOT_PENDING");
        },
      );
    });
  },
});
