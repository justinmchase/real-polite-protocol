import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

// ---------------------------------------------------------------------------
// Requirement tests
// ---------------------------------------------------------------------------

Deno.test({
  name:
    "req:invitations-009 - Senders can cancel a direct invitation they have sent",
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

          // Initialize account so a domain_id is assigned.
          await callTool(token, "set_user_verified_metadata");

          const receiverDomain = new URL(baseUrl).host;

          /**
           * Helper: open a fresh receptive window and send a self-invitation.
           * Returns the invitation_id of the newly created pending invitation.
           */
          const sendSelfInvitation = async (): Promise<string> => {
            const { result: policyResult } = await callTool<
              { policy_id: string }
            >(token, "open_receptive_window", { duration_seconds: 300 });
            assertExists(policyResult);

            const { result: invResult } = await callTool<
              { invitation_id: string }
            >(token, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyResult.policy_id,
              proposed_terms: { category: "billing" },
            });
            assertExists(invResult);
            return invResult.invitation_id;
          };

          await t.step(
            "cancel_invitation transitions a pending invitation to cancelled and returns the updated record",
            async () => {
              const invitationId = await sendSelfInvitation();

              const { status, result } = await callTool<{ status: string }>(
                token,
                "cancel_invitation",
                { invitation_id: invitationId },
              );

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.status, "cancelled");
            },
          );

          await t.step(
            "cancelled invitation is observable as cancelled via review_invitation",
            async () => {
              const invitationId = await sendSelfInvitation();
              await callTool(token, "cancel_invitation", {
                invitation_id: invitationId,
              });

              const { result } = await callTool<{ status: string }>(
                token,
                "review_invitation",
                { invitation_id: invitationId },
              );
              assertExists(result);
              assertEquals(result.status, "cancelled");
            },
          );

          await t.step(
            "cancel_invitation of an accepted invitation revokes all derived receipts with reason SUPERSEDED",
            async () => {
              const invitationId = await sendSelfInvitation();

              const { result: acceptResult } = await callTool<{
                receipt?: { id: string };
              }>(token, "accept_invitation", {
                invitation_id: invitationId,
              });
              const receiptId = acceptResult?.receipt?.id;
              assertExists(receiptId);

              await callTool(token, "cancel_invitation", {
                invitation_id: invitationId,
              });

              const { result: listResult } = await callTool<{
                receipts: Array<{
                  id: string;
                  status: string;
                  revocation_reason?: string;
                }>;
              }>(token, "list_issued_receipts", { status: "revoked" });
              assertExists(listResult);
              const found = listResult.receipts.find((r) => r.id === receiptId);
              assertExists(found);
              assertEquals(found.revocation_reason, "SUPERSEDED");
            },
          );

          await t.step(
            "cancelling an already-cancelled invitation returns E_INVITATION_NOT_CANCELLABLE",
            async () => {
              const invitationId = await sendSelfInvitation();
              // First cancel succeeds.
              await callTool(token, "cancel_invitation", {
                invitation_id: invitationId,
              });

              // Second cancel on a terminal state MUST fail.
              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(token, "cancel_invitation", { invitation_id: invitationId });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVITATION_NOT_CANCELLABLE",
              );
            },
          );

          await t.step(
            "cancel_invitation by a non-owner returns E_INVITATION_NOT_FOUND (existence is not revealed)",
            async () => {
              // Seed an invitation whose domain_id does not match the caller's.
              const invitationId = crypto.randomUUID();
              await kv.set(["invitations", invitationId], {
                invitation_id: invitationId,
                receiver_oid: accountOid,
                sender_domain: "other-sender.example",
                status: "pending",
                proposed_terms: { category: "billing" },
                claims: {
                  immutable: {
                    domain_id: "domain-id-that-does-not-belong-to-caller",
                  },
                },
                created_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(token, "cancel_invitation", {
                invitation_id: invitationId,
              });

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVITATION_NOT_FOUND",
              );
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
