import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";

Deno.test({
  name: "req:invitations-001 - Listeners can list inbound invitations",
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

          // Seed five inbound invitations in all five lifecycle states from
          // two different remote domains.
          await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            status: "pending",
          });
          await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            status: "accepted",
          });
          await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            status: "rejected",
          });
          await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            status: "expired",
          });
          await seedInboundInvitation(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            status: "cancelled",
          });
          // Seed one outbound invitation that must not appear.
          await seedOutboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
          });

          await t.step(
            "returns all inbound invitations in all states",
            async () => {
              const { status, result } = await callTool<{
                invitations: Array<{
                  invitation_id: string;
                  direction: string;
                  remote_domain: string;
                  status: string;
                  communication_terms: { categories: string[] };
                  sent_at: string;
                }>;
                page_size: number;
              }>(token, "list_invitations", { page_size: 50 });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.invitations.length, 5);
              const statuses = result.invitations.map((i) => i.status).sort();
              assertEquals(
                statuses,
                ["accepted", "cancelled", "expired", "pending", "rejected"],
              );
              assertEquals(
                result.invitations.every((i) => i.direction === "inbound"),
                true,
              );
              const inv = result.invitations[0];
              assertExists(inv.invitation_id);
              assertExists(inv.remote_domain);
              assertExists(inv.communication_terms.categories);
              assertExists(inv.sent_at);
            },
          );

          await t.step("filters by status=pending", async () => {
            const { result } = await callTool<{
              invitations: Array<{ status: string }>;
            }>(token, "list_invitations", { status: "pending" });
            assertExists(result);
            assertEquals(result.invitations.length, 1);
            assertEquals(result.invitations[0].status, "pending");
          });

          await t.step(
            "filters by remote_domain (case-insensitive)",
            async () => {
              const { result } = await callTool<{
                invitations: Array<{ remote_domain: string }>;
              }>(token, "list_invitations", { remote_domain: "BETA.EXAMPLE" });
              assertExists(result);
              assertEquals(result.invitations.length, 3);
              assertEquals(
                result.invitations.every((i) =>
                  i.remote_domain === "beta.example"
                ),
                true,
              );
            },
          );

          await t.step("isolated by owner OID", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result } = await callTool<{
              invitations: Array<unknown>;
            }>(otherToken, "list_invitations", {});
            assertExists(result);
            assertEquals(result.invitations.length, 0);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
