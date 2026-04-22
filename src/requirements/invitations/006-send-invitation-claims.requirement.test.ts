import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:invitations-006 - Senders can attach verified and custom claims to outgoing invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl, callTool }) => {
        const accountOid = crypto.randomUUID();
        const token = await issueToken({
          oid: accountOid,
          scope: requiredScopes.join(" "),
          name: "Alice Smith",
          email: "alice@sender.example",
        });

        // Populate user_verified_fields from token.
        await callTool(token, "set_user_verified_metadata");

        // Open a receptive window so send_invitation has a valid policy to deliver to.
        const { result: windowPolicy } = await callTool<{ policy_id: string }>(
          token,
          "open_receptive_window",
          { duration_seconds: 300 },
        );
        assertExists(windowPolicy);
        const policyId = windowPolicy.policy_id;
        const receiverDomain = new URL(baseUrl).host;

        await t.step("send_invitation with no claim inputs succeeds and omits claims", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              // no include_user_claims, include_admin_claims, or custom_claims
            },
          );

          assertEquals(status, 200);
          assertExists(result?.invitation_id);
        });

        await t.step("include_user_claims resolves values from stored user_verified_fields", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              include_user_claims: ["name", "email"],
            },
          );

          assertEquals(status, 200);
          assertExists(result?.invitation_id);
        });

        await t.step("missing keys in include_user_claims are silently dropped", async () => {
          // "nonexistent_key" does not exist in stored metadata — tool must not error.
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              include_user_claims: ["name", "nonexistent_key"],
            },
          );

          assertEquals(status, 200);
          assertExists(result?.invitation_id);
        });

        await t.step("custom_claims are included verbatim in the envelope", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              custom_claims: { note: "We met at the conference", year: 2026 },
            },
          );

          assertEquals(status, 200);
          assertExists(result?.invitation_id);
        });

        await t.step("all three claim types can be combined in one invitation", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              include_user_claims: ["name"],
              custom_claims: { reason: "Follow-up from summit" },
            },
          );

          assertEquals(status, 200);
          assertExists(result?.invitation_id);
        });
      });
    });
  },
});
