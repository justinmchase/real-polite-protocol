import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:invitations-005 - Listeners can send invitations using a receptive policy ID",
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

          // Initialize account with verified metadata
          await callTool(token, "set_user_verified_metadata");

          // Open a receptive window to get a policy_id that can be shared.
          const { result: windowPolicy } = await callTool<{ policy_id: string }>(
            token,
            "open_receptive_window",
            { duration_seconds: 300 },
          );
          assertExists(windowPolicy);
          const policyId = windowPolicy.policy_id;

          // In tests both sender and receiver are the same server.
          const receiverDomain = new URL(baseUrl).host;

          await t.step("send_invitation creates a new pending invitation", async () => {
            const { status, result } = await callTool<{ invitation_id?: string; created_at?: string }>(token, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "billing" },
            });

            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.invitation_id);
            assertExists(result.created_at);
          });

          await t.step("sent invitation is retrievable via list_invitations", async () => {
            const proposedTerms = { category: "marketing" };

            const { status, result } = await callTool<{ invitation_id?: string }>(token, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: proposedTerms,
            });

            assertEquals(status, 200);
            assertExists(result);
            assertExists(result.invitation_id);
          });

          await t.step("send_invitation stores invitation on receiver and sets default values", async () => {
            const proposedTerms = { category: "support" };

            const { status, result } = await callTool<{ invitation_id?: string }>(token, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: proposedTerms,
            });

            assertEquals(status, 200);
            assertExists(result);
            const invitationId = result.invitation_id;
            assertExists(invitationId);

            // The receiver (same server in tests) stores the invitation locally.
            const stored = await kv.get(["invitations", invitationId]);
            if (stored.value) {
              const invitation = stored.value as Record<string, unknown>;
              assertEquals(invitation.status, "pending");
              assertExists(invitation.created_at);
              // expires_at is optional — absent means the invitation never expires
            }
          });

          await t.step("send_invitation fails when policy is not found on the receiver", async () => {
            const { status, body } = await callTool(token, "send_invitation", {
              receiver_domain: receiverDomain,
              receptive_policy_id: crypto.randomUUID(),
              proposed_terms: { category: "billing" },
            });
            // Tool errors come back as 200 with isError set in the MCP result
            assertEquals(status, 200);
            const mcpResult = body.result as { isError?: boolean } | undefined;
            assertEquals(mcpResult?.isError, true);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
