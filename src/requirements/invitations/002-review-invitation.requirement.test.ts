import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";

Deno.test({
  name: "req:invitations-002 - Listeners can review a pending invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          const senderDomainId = crypto.randomUUID();
          const inv = await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            remoteDomainId: senderDomainId,
            senderDisplayName: "Alpha Co.",
            message: "Hi, let's connect.",
            claims: {
              immutable: { domain_id: senderDomainId },
              user: { name: "Alice" },
              admin: { dept: "Sales" },
              custom: { ref: "conf-2026" },
            },
          });

          await t.step("returns full invitation record", async () => {
            const { status, result } = await callTool<{
              invitation_id: string;
              direction: string;
              remote_domain: string;
              status: string;
              communication_terms: { categories: string[] };
              claims?: {
                immutable: Record<string, unknown>;
                user?: Record<string, unknown>;
                admin?: Record<string, unknown>;
                custom?: Record<string, unknown>;
              };
              sender_display_name?: string;
              message?: string;
              sent_at: string;
              created_at: string;
              reply_credential?: unknown;
            }>(token, "review_invitation", {
              invitation_id: inv.invitation_id,
            });
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.invitation_id, inv.invitation_id);
            assertEquals(result.direction, "inbound");
            assertEquals(result.remote_domain, "alpha.example");
            assertEquals(result.status, "pending");
            assertEquals(result.sender_display_name, "Alpha Co.");
            assertEquals(result.message, "Hi, let's connect.");
            assertExists(result.claims);
            assertEquals(result.claims.immutable.domain_id, senderDomainId);
            assertEquals(result.claims.user?.name, "Alice");
            assertEquals(result.claims.admin?.dept, "Sales");
            assertEquals(result.claims.custom?.ref, "conf-2026");
          });

          await t.step(
            "does NOT expose reply_credential to caller",
            async () => {
              const { result } = await callTool<Record<string, unknown>>(
                token,
                "review_invitation",
                { invitation_id: inv.invitation_id },
              );
              assertExists(result);
              assertEquals("reply_credential" in result, false);
            },
          );

          await t.step("unknown invitation_id errors", async () => {
            const { result, body } = await callTool(
              token,
              "review_invitation",
              {
                invitation_id: crypto.randomUUID(),
              },
            );
            const errorish = (result as { ok?: boolean } | undefined)?.ok ===
                false || body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step(
            "another account cannot review the invitation",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result, body } = await callTool(
                otherToken,
                "review_invitation",
                { invitation_id: inv.invitation_id },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
