import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test({
  name: "req:account-010 - Sender domain_id is always included as admin-verified claim on outgoing invitations",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool, baseUrl }) => {
        const senderOid = crypto.randomUUID();
        const adminOid = crypto.randomUUID();
        const token = await issueToken({
          oid: senderOid,
          scope: requiredScopes.join(" "),
          name: "Claim Sender",
          email: "sender@example.test",
        });
        const adminToken = await issueToken({
          oid: adminOid,
          roles: ["domain.admin"],
          scope: requiredScopes.join(" "),
        });

        // Provision account and obtain the assigned domain_id.
        await callGetPermissions(token, {}, baseUrl);

        const metadataResult = await callTool(adminToken, "get_user_verified_metadata", {
          oid: senderOid,
        });
        const metadataText = (
          metadataResult.body.result as { content?: Array<{ text?: string }> }
        ).content?.[0]?.text;
        assertExists(metadataText);
        const metadata = JSON.parse(metadataText) as {
          immutable_fields?: Record<string, string>;
        };
        const senderDomainId = metadata.immutable_fields?.domain_id;
        assertExists(senderDomainId, "sender must have a domain_id to proceed");

        // Open a receptive window for the self-send scenario.
        const { result: windowPolicy } = await callTool<{ policy_id: string }>(
          token,
          "open_receptive_window",
          { duration_seconds: 300 },
        );
        assertExists(windowPolicy);
        const policyId = windowPolicy.policy_id;
        const receiverDomain = new URL(baseUrl).host;

        await t.step("invitation without explicit claim inputs still includes domain_id as admin-verified claim", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              // No include_admin_claims specified — domain_id injected unconditionally.
            },
          );
          assertEquals(status, 200);
          const invitationId = result?.invitation_id;
          assertExists(invitationId);

          const { status: reviewStatus, result: reviewResult } = await callTool<{
            claims?: {
              immutable?: Record<string, string>;
            };
          }>(
            token,
            "review_invitation",
            { invitation_id: invitationId },
          );

          assertEquals(reviewStatus, 200);
          const domainId = reviewResult?.claims?.immutable?.domain_id;
          assertExists(domainId, "domain_id must be present in immutable claims");
          assertMatch(
            domainId,
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            "domain_id claim should be a UUID",
          );
          assertEquals(
            domainId,
            senderDomainId,
            "domain_id on invitation must match sender's assigned domain_id",
          );
        });

        await t.step("domain_id is present alongside other caller-requested admin claims", async () => {
          const { status, result } = await callTool<{ invitation_id?: string }>(
            token,
            "send_invitation",
            {
              receiver_domain: receiverDomain,
              receptive_policy_id: policyId,
              proposed_terms: { category: "correspondence" },
              include_admin_claims: ["nonexistent_key"], // should still get domain_id
            },
          );
          assertEquals(status, 200);
          const invitationId = result?.invitation_id;
          assertExists(invitationId);

          const { result: reviewResult } = await callTool<{
            claims?: { immutable?: Record<string, string> };
          }>(
            token,
            "review_invitation",
            { invitation_id: invitationId },
          );

          assertExists(reviewResult?.claims?.immutable?.domain_id);
          assertEquals(reviewResult?.claims?.immutable?.domain_id, senderDomainId);
        });

        await t.step("domain_id on invitation is the sender's, not a receiver value", async () => {
          // Verify we didn't accidentally use the receiver's domain_id or some other value.
          const { result: reviewResult } = await callTool<{
            claims?: { immutable?: Record<string, string> };
          }>(
            token,
            "review_invitation",
            // Re-use the invitation id from prior step via a fresh send.
            { invitation_id: (await callTool<{ invitation_id: string }>(
              token,
              "send_invitation",
              {
                receiver_domain: receiverDomain,
                receptive_policy_id: policyId,
                proposed_terms: { category: "correspondence" },
              },
            )).result!.invitation_id },
          );
          assertEquals(
            reviewResult?.claims?.immutable?.domain_id,
            senderDomainId,
          );
        });
      });
    });
  },
});
