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
  name: "req:invitations-003 - Listeners can accept a pending invitation",
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
            "accept_invitation transitions invitation to accepted and delivers receipt callback",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                const { status, result } = await callTool<{
                  status: string;
                  accepted_at?: string;
                }>(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                assertEquals(status, 200);
                assertExists(result);
                assertEquals(result.status, "accepted");
                assertExists(result.accepted_at);

                // The server MUST have POSTed a receipt envelope to the
                // delivery domain (Section 9.7.2, invitations-003).
                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                const cb = callbacks[0];
                assertEquals(cb.body.category, "receipt");
                assertEquals(cb.body.invitation_id, invitationId);
                assertEquals(cb.body.decision, "accepted");
                assertExists(cb.body.receipt);
              });
            },
          );

          await t.step(
            "receipt callback carries issued receipt credentials",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                const receipt = callbacks[0].body.receipt as
                  | Record<string, unknown>
                  | undefined;

                assertExists(receipt);
                assertExists(receipt.id);
                assertExists(receipt.secret);
                assertExists(receipt.category);
                assertExists(receipt.max_content_rating);
                assertExists(receipt.issued_at);
              });
            },
          );

          await t.step(
            "receipt callback is HMAC-signed with the delivery token",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const callbacks = getCaptures();
                assertEquals(callbacks.length, 1);
                const { headers, bodyBytes } = callbacks[0];

                // x-rpp-invitation-id, not x-rpp-receipt-id, on receipt envelopes
                assertEquals(headers["x-rpp-invitation-id"], invitationId);
                assertExists(headers["x-rpp-timestamp"]);
                assertExists(headers["x-rpp-signature"]);

                // Verify HMAC over raw body bytes using the delivery token
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
            "accept_invitation includes optional reason in the callback",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "partner.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                const reason = "Looking forward to working with you!";

                await callTool(token, "accept_invitation", {
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
            "accept_invitation can apply negotiated terms",
            async () => {
              await withCallbackServer(async (callbackDomain) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "another-partner.example",
                  status: "pending",
                  proposed_terms: { category: "correspondence" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  expires_at: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  created_at: new Date().toISOString(),
                });

                const { status, result } = await callTool<{ status: string }>(
                  token,
                  "accept_invitation",
                  {
                    invitation_id: invitationId,
                    negotiated_terms: {
                      category: "correspondence",
                      max_content_rating: "G",
                    },
                  },
                );

                assertEquals(status, 200);
                assertExists(result);
                assertEquals(result.status, "accepted");
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
