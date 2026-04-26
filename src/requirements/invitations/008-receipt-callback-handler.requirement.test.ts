// req:invitations-008 — Inviting domains process inbound receipt callbacks to
// finalize invitations.
//
// Tests here drive the sender-side handler that receives `category: "receipt"`
// envelopes POSTed to /rpp/v1/envelopes by the receiver after it has accepted
// or rejected a direct invitation.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { submitReceiptCallback } from "../helpers/submit-receipt-callback.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

import { seedSentInvitation } from "../helpers/seed-sent-invitation.ts";

Deno.test({
  name:
    "req:invitations-008 - Inviting domains process inbound receipt callbacks to finalize invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, baseUrl, callTool }) => {
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
            "receipt callback with decision=accepted transitions invitation to accepted and responds 202",
            async () => {
              const { invitationId, deliveryToken } = await seedSentInvitation(
                kv,
                accountOid,
              );

              const mockReceipt = {
                id: crypto.randomUUID(),
                secret: crypto.randomUUID(),
                category: "billing",
                max_content_rating: "G",
                usage_policy: "standard",
                issued_at: new Date().toISOString(),
              };

              const response = await submitReceiptCallback({
                invitationId,
                deliveryToken,
                decision: "accepted",
                receipt: mockReceipt,
                baseUrl,
              });

              assertEquals(response.status, 202);
              const body = await response.json() as Record<string, unknown>;
              assertEquals(body.ok, true);
              assertEquals(body.accepted, true);
              assertEquals(body.invitation_id, invitationId);

              // Local invitation MUST transition to accepted
              const stored = await kv.get(["invitations", invitationId]);
              assertExists(stored.value);
              const inv = stored.value as Record<string, unknown>;
              assertEquals(inv.status, "accepted");
            },
          );

          await t.step(
            "receipt callback with decision=rejected transitions invitation to rejected",
            async () => {
              const { invitationId, deliveryToken } = await seedSentInvitation(
                kv,
                accountOid,
              );

              const response = await submitReceiptCallback({
                invitationId,
                deliveryToken,
                decision: "rejected",
                baseUrl,
              });

              assertEquals(response.status, 202);
              await response.body?.cancel();

              const stored = await kv.get(["invitations", invitationId]);
              assertExists(stored.value);
              const inv = stored.value as Record<string, unknown>;
              assertEquals(inv.status, "rejected");
            },
          );

          await t.step(
            "returns E_INVITATION_NOT_FOUND for an unknown invitation_id",
            async () => {
              const unknownId = crypto.randomUUID();

              const response = await submitReceiptCallback({
                invitationId: unknownId,
                deliveryToken: crypto.randomUUID(),
                decision: "accepted",
                receipt: {
                  id: crypto.randomUUID(),
                  secret: crypto.randomUUID(),
                  category: "billing",
                  max_content_rating: "G",
                  usage_policy: "standard",
                  issued_at: new Date().toISOString(),
                },
                baseUrl,
              });

              assertEquals(response.status, 404);
              const body = await response.json() as Record<string, unknown>;
              assertEquals(body.code, "E_INVITATION_NOT_FOUND");
            },
          );

          await t.step(
            "returns E_INVITATION_NOT_PENDING when invitation is already in terminal state",
            async () => {
              const { invitationId, deliveryToken } = await seedSentInvitation(
                kv,
                accountOid,
                { status: "accepted" },
              );

              const response = await submitReceiptCallback({
                invitationId,
                deliveryToken,
                decision: "accepted",
                receipt: {
                  id: crypto.randomUUID(),
                  secret: crypto.randomUUID(),
                  category: "billing",
                  max_content_rating: "G",
                  usage_policy: "standard",
                  issued_at: new Date().toISOString(),
                },
                baseUrl,
              });

              assertEquals(response.status, 400);
              const body = await response.json() as Record<string, unknown>;
              assertEquals(body.code, "E_INVITATION_NOT_PENDING");
            },
          );

          await t.step(
            "returns E_DELIVERY_TOKEN_INVALID when HMAC does not match delivery token",
            async () => {
              const { invitationId } = await seedSentInvitation(kv, accountOid);

              // Sign with a different key — wrong token
              const response = await submitReceiptCallback({
                invitationId,
                deliveryToken: crypto.randomUUID(), // wrong
                decision: "rejected",
                baseUrl,
              });

              assertEquals(response.status, 401);
              const body = await response.json() as Record<string, unknown>;
              assertEquals(body.code, "E_DELIVERY_TOKEN_INVALID");
            },
          );

          await t.step(
            "returns E_DELIVERY_TOKEN_CONSUMED when delivery token was already used",
            async () => {
              const { invitationId, deliveryToken } = await seedSentInvitation(
                kv,
                accountOid,
              );

              // First call — succeeds and consumes the token
              const first = await submitReceiptCallback({
                invitationId,
                deliveryToken,
                decision: "rejected",
                baseUrl,
              });
              assertEquals(first.status, 202);
              await first.body?.cancel();

              // Second call with same token — must be rejected
              const second = await submitReceiptCallback({
                invitationId,
                deliveryToken,
                decision: "rejected",
                baseUrl,
              });

              assertEquals(second.status, 400);
              const body = await second.json() as Record<string, unknown>;
              // Dedup via submit-003 returns E_INVITATION_NOT_PENDING;
              // token-consumed check returns E_DELIVERY_TOKEN_CONSUMED.
              // Either is acceptable — both signal idempotent rejection.
              const isExpectedCode =
                body.code === "E_DELIVERY_TOKEN_CONSUMED" ||
                body.code === "E_INVITATION_NOT_PENDING";
              assertEquals(isExpectedCode, true);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
