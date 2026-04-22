import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:invitations-002 - Listeners can review a pending invitation",
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
          const proposedTerms = {
            category: "billing",
            max_messages_per_day: 100,
          };

          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "trusted-partner.example",
            status: "pending",
            proposed_terms: proposedTerms,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString(),
            created_at: new Date().toISOString(),
          });

          await t.step(
            "review_invitation returns full invitation details",
            async () => {
              const { status, result } = await callTool<
                {
                  invitation_id: string;
                  receiver_oid: string;
                  sender_domain: string;
                  status: string;
                  proposed_terms: Record<string, unknown>;
                }
              >(token, "review_invitation", {
                invitation_id: invitationId,
              });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.invitation_id, invitationId);
              assertEquals(result.receiver_oid, accountOid);
              assertEquals(result.sender_domain, "trusted-partner.example");
              assertEquals(result.status, "pending");
              assertEquals(result.proposed_terms, proposedTerms);
            },
          );

          await t.step(
            "review_invitation can fetch accepted invitation",
            async () => {
              const acceptedInvitationId = crypto.randomUUID();
              await kv.set(["invitations", acceptedInvitationId], {
                invitation_id: acceptedInvitationId,
                receiver_oid: accountOid,
                sender_domain: "another-partner.example",
                status: "accepted",
                proposed_terms: { category: "marketing" },
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  .toISOString(),
                created_at: new Date().toISOString(),
                accepted_at: new Date().toISOString(),
              });

              const { status, result } = await callTool<
                { status: string; accepted_at?: string }
              >(token, "review_invitation", {
                invitation_id: acceptedInvitationId,
              });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.status, "accepted");
              assertExists(result.accepted_at);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
