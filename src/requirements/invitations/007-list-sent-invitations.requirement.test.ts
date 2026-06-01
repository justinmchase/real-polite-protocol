import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";

Deno.test({
  name: "req:invitations-007 - Senders can list invitations they have sent",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(token, "set_user_verified_metadata");

          await seedOutboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            status: "pending",
          });
          await seedOutboundInvitation(kv, {
            ownerOid,
            remoteDomain: "alpha.example",
            status: "accepted",
          });
          await seedOutboundInvitation(kv, {
            ownerOid,
            remoteDomain: "beta.example",
            status: "cancelled",
          });
          // Inbound should NOT appear.
          await seedInboundInvitation(kv, { ownerOid });

          await t.step("returns outbound records only", async () => {
            const { status, result } = await callTool<{
              invitations: Array<{
                invitation_id: string;
                direction: string;
                remote_domain: string;
                status: string;
                communication_terms: { categories: string[] };
                reply_credential?: unknown;
              }>;
              page_size: number;
            }>(token, "list_sent_invitations", {});
            assertEquals(status, 200);
            assertExists(result);
            assertEquals(result.invitations.length, 3);
            assertEquals(
              result.invitations.every((i) => i.direction === "outbound"),
              true,
            );
            // reply_credential.contact_secret MUST NOT be exposed.
            assertEquals(
              result.invitations.every((i) =>
                !("reply_credential" in i) ||
                !(i.reply_credential as { contact_secret?: unknown })
                  ?.contact_secret
              ),
              true,
            );
          });

          await t.step("filters by status", async () => {
            const { result } = await callTool<{
              invitations: Array<{ status: string }>;
            }>(token, "list_sent_invitations", { status: "pending" });
            assertExists(result);
            assertEquals(result.invitations.length, 1);
            assertEquals(result.invitations[0].status, "pending");
          });

          await t.step(
            "filters by remote_domain (case-insensitive)",
            async () => {
              const { result } = await callTool<{
                invitations: Array<{ remote_domain: string }>;
              }>(token, "list_sent_invitations", {
                remote_domain: "ALPHA.EXAMPLE",
              });
              assertExists(result);
              assertEquals(result.invitations.length, 2);
              assertEquals(
                result.invitations.every((i) =>
                  i.remote_domain === "alpha.example"
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
            }>(otherToken, "list_sent_invitations", {});
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
