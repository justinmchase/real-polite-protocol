/**
 * Seeds a locally-pending invitation (sender's side) in the given KV store
 * with a known delivery token. Returns the invitation ID and delivery token.
 */
export async function seedSentInvitation(
  kv: Deno.Kv,
  accountOid: string,
  opts?: { status?: string; deliveryToken?: string },
): Promise<{ invitationId: string; deliveryToken: string }> {
  const invitationId = crypto.randomUUID();
  const deliveryToken = opts?.deliveryToken ?? crypto.randomUUID();
  await kv.set(["invitations", invitationId], {
    invitation_id: invitationId,
    receiver_oid: accountOid,
    sender_oid: accountOid,
    receiver_domain: "receiver.example",
    sender_domain: "sender.example",
    status: opts?.status ?? "pending",
    proposed_terms: { category: "billing" },
    delivery: {
      domain: "sender.example",
      token: deliveryToken,
    },
    created_at: new Date().toISOString(),
  });
  return { invitationId, deliveryToken };
}
