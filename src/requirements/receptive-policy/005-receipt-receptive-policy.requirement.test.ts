import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

// Receipt-mode receptive policies are auto-created when a listener accepts an
// invitation.  They allow the original sender to re-invite via the issued
// receipt_id.  Revoking the receipt deletes the policy (no deactivated state).

Deno.test({
  name:
    "req:receptive-policy-005 - Receipt-mode receptive policy enables receipt-based re-invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const receiverOid = crypto.randomUUID();
          const receiverToken = await issueToken({
            oid: receiverOid,
            scope: requiredScopes.join(" "),
            name: "Receiver",
          });
          await callTool(receiverToken, "set_user_verified_metadata");

          const senderOid = crypto.randomUUID();
          const senderToken = await issueToken({
            oid: senderOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(senderToken, "set_user_verified_metadata");

          const serverHost = `localhost:${port}`;
          const senderDomainId = crypto.randomUUID();

          // Seed a pending invitation to trigger acceptance.
          const inv1Id = crypto.randomUUID();
          await kv.set(["invitations", inv1Id], {
            invitation_id: inv1Id,
            receiver_oid: receiverOid,
            sender_domain: serverHost,
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: senderDomainId } },
            created_at: new Date().toISOString(),
          });

          let receiptId: string | undefined;
          let receiptPolicyId: string | undefined;

          await t.step(
            "accepting invitation issues a receipt and auto-creates a receipt-mode policy",
            async () => {
              const { result } = await callTool<{
                receipt?: { id: string };
              }>(receiverToken, "accept_invitation", {
                invitation_id: inv1Id,
              });
              assertExists(result?.receipt?.id);
              receiptId = result!.receipt!.id;

              // Verify a receipt-mode policy was auto-created for this receipt.
              const { result: policyList } = await callTool<{
                policies: Array<{
                  policy_id: string;
                  mode: string;
                  receipt_id?: string;
                }>;
              }>(receiverToken, "get_receptive_policies", {
                include_receipt_policies: true,
              });
              assertExists(policyList);
              const receiptPolicy = policyList.policies.find(
                (p) => p.mode === "receipt" && p.receipt_id === receiptId,
              );
              assertExists(
                receiptPolicy,
                "a receipt-mode policy should be auto-created for the new receipt",
              );
              receiptPolicyId = receiptPolicy!.policy_id;
            },
          );

          await t.step(
            "sender can re-invite via the receipt_id",
            async () => {
              assertExists(receiptId);
              const { status, result } = await callTool<{
                invitation_id: string;
              }>(senderToken, "send_invitation", {
                receiver_domain: serverHost,
                receipt_id: receiptId,
                proposed_terms: { category: "support" },
              });
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.invitation_id);
            },
          );

          await t.step(
            "revoking the receipt deletes the receipt-mode policy",
            async () => {
              assertExists(receiptId);
              // Revoke the receipt via the receiver's tool.
              const revokeResult = await callTool<{
                id: string;
                status: string;
              }>(receiverToken, "revoke_receipt", {
                receipt_id: receiptId,
                reason: "SENDER_REQUEST",
              });
              assertExists(revokeResult.result);
              assertEquals(revokeResult.result.status, "revoked");

              // Verify the receipt is revoked
              const receiptEntry = await kv.get<{ status: string }>(
                ["receipts", receiptId],
              );
              assertExists(receiptEntry.value);
              assertEquals(receiptEntry.value.status, "revoked");

              // Verify the receipt-mode policy is deleted.
              assertExists(receiptPolicyId);
              const entry = await kv.get(["receptive_policies", receiptPolicyId]);
              assertEquals(entry.value, null);
            },
          );

          await t.step(
            "sender cannot re-invite after the receipt is revoked",
            async () => {
              assertExists(receiptId);
              const { result } = await callTool<{ ok?: boolean }>(
                senderToken,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receipt_id: receiptId,
                  proposed_terms: { category: "billing" },
                },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
