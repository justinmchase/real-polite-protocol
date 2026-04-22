import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

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

          const invitationId = crypto.randomUUID();

          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "untrusted-partner.example",
            status: "pending",
            proposed_terms: { category: "billing" },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
          });

          await t.step("reject_invitation transitions invitation to rejected", async () => {
            const { status, result } = await callTool<{ status: string }>(token, "reject_invitation", {
              invitation_id: invitationId,
            });

            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.status, "rejected");
          });

          await t.step("rejecting invitation prevents future interactions", async () => {
            const invitationId2 = crypto.randomUUID();

            await kv.set(["invitations", invitationId2], {
              invitation_id: invitationId2,
              receiver_oid: accountOid,
              sender_domain: "another-partner.example",
              status: "pending",
              proposed_terms: { category: "marketing" },
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              created_at: new Date().toISOString(),
            });

            // Reject the invitation
            await callTool(token, "reject_invitation", {
              invitation_id: invitationId2,
            });

            // Try to accept the rejected invitation
            await callTool(token, "accept_invitation", {
              invitation_id: invitationId2,
            });

            // Should fail or the invitation should remain rejected
            const reviewResult = await callTool<{ status: string }>(token, "review_invitation", {
              invitation_id: invitationId2,
            });
            assertExists(reviewResult.result);
            assertEquals(reviewResult.result.status, "rejected");
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
