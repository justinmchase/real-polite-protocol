import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:invitations-001 - Listeners can list their invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          // Create test account and get token
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          // Initialize account with verified metadata
          await callTool(token, "set_user_verified_metadata");

          // Create test invitations
          const invitationId1 = crypto.randomUUID();
          const invitationId2 = crypto.randomUUID();

          await kv.set(["invitations", invitationId1], {
            invitation_id: invitationId1,
            receiver_oid: accountOid,
            sender_domain: "sender1.example",
            status: "pending",
            proposed_terms: { category: "billing" },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString(),
            created_at: new Date().toISOString(),
          });

          await kv.set(["invitations", invitationId2], {
            invitation_id: invitationId2,
            receiver_oid: accountOid,
            sender_domain: "sender2.example",
            status: "accepted",
            proposed_terms: { category: "marketing" },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString(),
            created_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
          });

          await t.step(
            "list_invitations returns all invitations for the user",
            async () => {
              const { status, result } = await callTool<
                { invitations: Array<{ invitation_id: string }> }
              >(token, "list_invitations", {});

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.invitations.length, 2);
            },
          );

          await t.step("list_invitations can filter by status", async () => {
            const { status, result } = await callTool<
              { invitations: Array<{ status: string }> }
            >(token, "list_invitations", {
              status: "pending",
            });

            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.invitations.length, 1);
            assertEquals(result.invitations[0].status, "pending");
          });

          await t.step(
            "list_invitations can filter by sender domain",
            async () => {
              const { status, result } = await callTool<
                { invitations: Array<{ sender_domain: string }> }
              >(token, "list_invitations", {
                sender_domain: "sender1.example",
              });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.invitations.length, 1);
              assertEquals(
                result.invitations[0].sender_domain,
                "sender1.example",
              );
            },
          );

          await t.step(
            "list_invitations respects page_size limit",
            async () => {
              const { status, result } = await callTool<
                { invitations: Array<unknown>; page_size?: number }
              >(token, "list_invitations", {
                page_size: 1,
              });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.invitations.length, 1);
              assertEquals(result.page_size, 1);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
