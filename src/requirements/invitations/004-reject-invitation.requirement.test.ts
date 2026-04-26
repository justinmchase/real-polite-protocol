import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";

// ---------------------------------------------------------------------------
// Requirement tests
// ---------------------------------------------------------------------------

Deno.test({
  name: "req:invitations-004 - Listeners can reject a pending invitation",
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

          // Initialize account with verified metadata
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "reject_invitation transitions invitation to rejected and delivers callback",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "untrusted-partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                const { status, result } = await callTool<{ status: string }>(
                  token,
                  "reject_invitation",
                  { invitation_id: invitationId },
                );

                assertEquals(status, 200);
                assertExists(result);
                assertEquals(result.status, "rejected");

                // The server MUST have posted a receipt callback with decision=rejected.
                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                assertEquals(callbacks[0].body.category, "receipt");
                assertEquals(callbacks[0].body.invitation_id, invitationId);
                assertEquals(callbacks[0].body.decision, "rejected");
                // No receipt object on rejection.
                assertEquals(callbacks[0].body.receipt, undefined);
              });
            },
          );

          await t.step(
            "rejection callback is HMAC-signed with the delivery token",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "untrusted-partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "reject_invitation", {
                  invitation_id: invitationId,
                });

                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                const { headers, bodyBytes } = callbacks[0];

                assertEquals(headers["x-rpp-invitation-id"], invitationId);
                assertExists(headers["x-rpp-timestamp"]);
                assertExists(headers["x-rpp-signature"]);

                const expectedSig = await computeHmac(
                  deliveryToken,
                  headers["x-rpp-timestamp"],
                  bodyBytes,
                );
                assertEquals(headers["x-rpp-signature"], expectedSig);
              });
            },
          );

          await t.step(
            "reject_invitation includes optional reason in the callback",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "untrusted-partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                const reason = "Not a fit at this time.";

                await callTool(token, "reject_invitation", {
                  invitation_id: invitationId,
                  reason,
                });

                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                assertEquals(callbacks[0].body.reason, reason);
              });
            },
          );

          await t.step(
            "rejecting invitation prevents future interactions",
            async () => {
              await withCallbackServer(async (callbackDomain) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "another-partner.example",
                  status: "pending",
                  proposed_terms: { category: "marketing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "reject_invitation", {
                  invitation_id: invitationId,
                });

                // Attempting to accept a rejected invitation must fail.
                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const reviewResult = await callTool<{ status: string }>(
                  token,
                  "review_invitation",
                  { invitation_id: invitationId },
                );
                assertExists(reviewResult.result);
                assertEquals(reviewResult.result.status, "rejected");
              });
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
