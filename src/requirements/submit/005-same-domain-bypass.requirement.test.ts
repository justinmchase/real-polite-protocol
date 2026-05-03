// req:submit-005 — Envelope delivery bypasses outbound HTTP for same-domain recipients.
//
// Each tool that delivers an envelope (send_invitation, invite_contact,
// send_message) must detect when the target domain equals the local server
// domain and call the local handler directly, avoiding a 508 Loop Detected
// error from Deno Deploy's self-loop detection.
//
// send_invitation and send_message same-domain bypasses are tested in their
// own requirement test files (invitations/005, messages/001). This file tests
// the invite_contact same-domain bypass.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:submit-005 - Envelope delivery bypasses outbound HTTP for same-domain recipients",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          await callTool(token, "set_user_verified_metadata");

          // The test server is both sender and receiver.
          // Seed an invitation from localhost so accept_invitation creates a
          // contact with domain = "localhost:{port}".
          const receiverDomain = `localhost:${port}`;
          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: receiverDomain,
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: crypto.randomUUID() } },
            created_at: new Date().toISOString(),
          });
          await callTool(token, "accept_invitation", { invitation_id: invId });

          // Resolve the contact that was created by acceptance.
          const { result: list } = await callTool<{
            contacts: Array<{ id: string }>;
          }>(token, "list_contacts", {});
          assertExists(list);
          const contactId = list!.contacts[0]?.id;
          assertExists(contactId);

          // Open a receptive window so invite_contact has a policy to target.
          const { result: window } = await callTool<{ policy_id: string }>(
            token,
            "open_receptive_window",
            { duration_seconds: 300 },
          );
          assertExists(window);
          const policyId = window!.policy_id;

          await t.step(
            "invite_contact same-domain delivery stores invitation without outbound HTTP",
            async () => {
              const { status, result } = await callTool<{
                invitation_id?: string;
                created_at?: string;
              }>(token, "invite_contact", {
                contact_id: contactId,
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
              });

              assertEquals(status, 200);
              assertExists(result?.invitation_id);
              assertExists(result?.created_at);

              // The invitation must be stored locally with a delivery block.
              const stored = await kv.get([
                "invitations",
                result!.invitation_id!,
              ]);
              assertExists(stored.value);
              const inv = stored.value as Record<string, unknown>;
              assertEquals(inv.status, "pending");

              // delivery block must be present for receipt callbacks.
              const delivery = inv.delivery as
                | Record<string, unknown>
                | undefined;
              assertExists(delivery);
              assertExists(delivery.token);
            },
          );

          await t.step(
            "accept_invitation same-domain records receipt summary on the sender's view of the invitation",
            async () => {
              // Provision a second account (BEAU = the sender) and have BEAU
              // send an invitation to the original test account (USER) on the
              // same local domain. After USER accepts, BEAU's review_invitation
              // must surface the issued receipt summary (Section 9.7.3 step 5,
              // adapted for same-domain delivery).
              const beauOid = crypto.randomUUID();
              const beauToken = await issueToken({
                oid: beauOid,
                scope: requiredScopes.join(" "),
                name: "Beau",
              });
              await callTool(beauToken, "set_user_verified_metadata");

              // USER opens a fresh receptive window for BEAU to target.
              const { result: userWindow } = await callTool<
                { policy_id: string }
              >(token, "open_receptive_window", { duration_seconds: 300 });
              assertExists(userWindow);

              // BEAU sends an invitation to USER on the same domain.
              const { result: sent } = await callTool<{
                invitation_id?: string;
              }>(beauToken, "send_invitation", {
                receiver_domain: receiverDomain,
                receptive_policy_id: userWindow!.policy_id,
                proposed_terms: { category: "billing" },
              });
              assertExists(sent?.invitation_id);
              const beauInvId = sent!.invitation_id!;

              // USER accepts.
              const { result: acceptResult } = await callTool<{
                receipt?: { id: string };
              }>(token, "accept_invitation", {
                invitation_id: beauInvId,
                reason: "Looking forward to it",
              });
              assertExists(acceptResult?.receipt?.id);
              const issuedReceiptId = acceptResult!.receipt!.id;

              // BEAU reviews the invitation and must see the acceptance state
              // plus a receipt summary referencing the same receipt id.
              const { result: review } = await callTool<{
                status?: string;
                receipt?: { id?: string; category?: string };
                decision_reason?: string;
              }>(beauToken, "review_invitation", {
                invitation_id: beauInvId,
              });
              assertExists(review);
              assertEquals(review!.status, "accepted");
              assertExists(review!.receipt);
              assertEquals(review!.receipt!.id, issuedReceiptId);
              assertEquals(review!.receipt!.category, "billing");
              assertEquals(review!.decision_reason, "Looking forward to it");
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
