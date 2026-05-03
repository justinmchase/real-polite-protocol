// req:invitations-007 — Receivers deliver an acceptance or rejection callback
// to the inviting domain.
//
// Tests in this file verify the delivery mechanics of the receipt callback:
// the envelope shape, the HMAC signing, the callback endpoint derived from
// delivery.domain, and that a permanent delivery failure is surfaced by
// marking the invitation `undelivered`.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";
import { withFailingCallbackServer } from "../helpers/with-failing-callback-server.ts";

Deno.test({
  name:
    "req:invitations-007 - Receivers deliver an acceptance or rejection callback to the inviting domain",
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

          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "acceptance callback is sent to the URL derived from delivery.domain",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                // The stub server is what the server POSTed to.
                // If delivery did not reach it, captures will be empty.
                const captures = getCaptures();
                assertEquals(captures.length, 1);
              });
            },
          );

          await t.step(
            "acceptance callback envelope has correct shape (category, invitation_id, decision, receipt)",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const captures = getCaptures();
                assertEquals(captures.length, 1);
                const { body } = captures[0];
                assertEquals(body.category, "receipt");
                assertEquals(body.invitation_id, invitationId);
                assertEquals(body.decision, "accepted");
                assertExists(body.receipt);
                const receipt = body.receipt as Record<string, unknown>;
                assertExists(receipt.id);
                assertExists(receipt.secret);
                assertExists(receipt.category);
                assertExists(receipt.issued_at);
              });
            },
          );

          await t.step(
            "rejection callback envelope has correct shape (decision=rejected, no receipt)",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "reject_invitation", {
                  invitation_id: invitationId,
                });

                const captures = getCaptures();
                assertEquals(captures.length, 1);
                const { body } = captures[0];
                assertEquals(body.category, "receipt");
                assertEquals(body.invitation_id, invitationId);
                assertEquals(body.decision, "rejected");
                // No receipt object on rejection
                assertEquals(body.receipt, undefined);
              });
            },
          );

          await t.step(
            "callback request carries x-rpp-invitation-id header (not x-rpp-receipt-id)",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const captures = getCaptures();
                assertEquals(captures.length, 1);
                const { headers } = captures[0];

                assertEquals(headers["x-rpp-invitation-id"], invitationId);
                // x-rpp-receipt-id MUST NOT be sent on a receipt callback
                assertEquals(headers["x-rpp-receipt-id"], undefined);
                assertExists(headers["x-rpp-timestamp"]);
                assertExists(headers["x-rpp-signature"]);
              });
            },
          );

          await t.step(
            "callback HMAC is signed with the delivery token",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });

                const captures = getCaptures();
                assertEquals(captures.length, 1);
                const { headers, bodyBytes } = captures[0];

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
            "invitation is marked undelivered when callback endpoint returns a permanent 4xx",
            async () => {
              // 400 from the inviting domain's envelope endpoint is a
              // permanent failure — the server MUST mark the invitation
              // undelivered instead of hanging in a pending/accepted state.
              await withFailingCallbackServer(
                400,
                async (callbackDomain) => {
                  const invitationId = crypto.randomUUID();
                  const deliveryToken = crypto.randomUUID();

                  await kv.set(["invitations", invitationId], {
                    invitation_id: invitationId,
                    receiver_oid: accountOid,
                    sender_domain: "sender.example",
                    status: "pending",
                    proposed_terms: { category: "billing" },
                    delivery: { domain: callbackDomain, token: deliveryToken },
                    created_at: new Date().toISOString(),
                  });

                  await callTool(token, "accept_invitation", {
                    invitation_id: invitationId,
                  });

                  // After the permanent failure the local invitation should be
                  // marked `undelivered` so the listener / operator can see it.
                  const stored = await kv.get(["invitations", invitationId]);
                  assertExists(stored.value);
                  const inv = stored.value as Record<string, unknown>;
                  assertEquals(inv.status, "undelivered");
                },
              );
            },
          );
          await t.step(
            "delivery token is rejected on second use after successful 202 acceptance",
            async () => {
              await withCallbackServer(async (callbackDomain, getCaptures) => {
                const invitationId = crypto.randomUUID();
                const deliveryToken = crypto.randomUUID();

                await kv.set(["invitations", invitationId], {
                  invitation_id: invitationId,
                  receiver_oid: accountOid,
                  sender_domain: "sender.example",
                  status: "pending",
                  proposed_terms: { category: "billing" },
                  delivery: { domain: callbackDomain, token: deliveryToken },
                  created_at: new Date().toISOString(),
                });

                // First acceptance should succeed.
                await callTool(token, "accept_invitation", {
                  invitation_id: invitationId,
                });
                assertEquals(getCaptures().length, 1);

                // Second acceptance on the same now-accepted invitation must fail.
                const { status, body } = await callTool(
                  token,
                  "accept_invitation",
                  { invitation_id: invitationId },
                );
                assertEquals(
                  status,
                  200,
                  "tool call itself should return 200 (tool-level error)",
                );
                // The tool should return a structured error — not a second success.
                const bodyUnknown = body as unknown as {
                  isError?: boolean;
                  result?: { isError?: boolean };
                };
                assertEquals(
                  bodyUnknown.isError ?? bodyUnknown.result?.isError,
                  true,
                  "second accept must return a tool-level error",
                );
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
