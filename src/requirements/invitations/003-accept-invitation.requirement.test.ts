import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

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

          const invitationId = crypto.randomUUID();
          const proposedTerms = { category: "billing" };

          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "partner.example",
            status: "pending",
            proposed_terms: proposedTerms,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString(),
            created_at: new Date().toISOString(),
          });

          await t.step(
            "accept_invitation transitions invitation to accepted",
            async () => {
              const { status, result } = await callTool<
                { status: string; accepted_at?: string }
              >(token, "accept_invitation", {
                invitation_id: invitationId,
              });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.status, "accepted");
              assertExists(result.accepted_at);
            },
          );

          await t.step(
            "accept_invitation can apply negotiated terms",
            async () => {
              const invitationId2 = crypto.randomUUID();
              const originalTerms = { category: "correspondence" };
              const negotiatedTerms = {
                category: "correspondence",
                max_content_rating: "G",
              };

              await kv.set(["invitations", invitationId2], {
                invitation_id: invitationId2,
                receiver_oid: accountOid,
                sender_domain: "another-partner.example",
                status: "pending",
                proposed_terms: originalTerms,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  .toISOString(),
                created_at: new Date().toISOString(),
              });

              const { status, result } = await callTool<{ status: string }>(
                token,
                "accept_invitation",
                {
                  invitation_id: invitationId2,
                  negotiated_terms: negotiatedTerms,
                },
              );

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.status, "accepted");
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
