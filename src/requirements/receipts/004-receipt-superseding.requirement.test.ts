import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:receipts-004 - Receipt superseding on new acceptance",
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

          await callTool(token, "set_user_verified_metadata");

          const senderDomainId = crypto.randomUUID();
          const senderDomain = "sender.example";

          // Seed first invitation with claims.immutable.domain_id
          const inv1Id = crypto.randomUUID();
          await kv.set(["invitations", inv1Id], {
            invitation_id: inv1Id,
            receiver_oid: accountOid,
            sender_domain: senderDomain,
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: senderDomainId } },
            created_at: new Date().toISOString(),
          });

          let receipt1Id: string | undefined;

          await t.step(
            "accepting first invitation issues an active receipt",
            async () => {
              const { result } = await callTool<{
                receipt?: { id: string; status?: string };
              }>(token, "accept_invitation", { invitation_id: inv1Id });
              assertExists(result?.receipt?.id);
              receipt1Id = result!.receipt!.id;
            },
          );

          // Seed second invitation with the same sender_domain + domain_id
          const inv2Id = crypto.randomUUID();
          await kv.set(["invitations", inv2Id], {
            invitation_id: inv2Id,
            receiver_oid: accountOid,
            sender_domain: senderDomain,
            status: "pending",
            proposed_terms: { category: "support" },
            claims: { immutable: { domain_id: senderDomainId } },
            created_at: new Date().toISOString(),
          });

          let receipt2Id: string | undefined;

          await t.step(
            "accepting second invitation issues a different new receipt",
            async () => {
              const { result } = await callTool<{
                receipt?: { id: string };
              }>(token, "accept_invitation", { invitation_id: inv2Id });
              assertExists(result?.receipt?.id);
              receipt2Id = result!.receipt!.id;
              assertEquals(receipt2Id !== receipt1Id, true);
            },
          );

          await t.step(
            "first receipt is revoked with reason SUPERSEDED",
            async () => {
              assertExists(receipt1Id);
              const entry = await kv.get<{
                status: string;
                revocation_reason: string;
                revoked_at: string;
              }>(["receipts", receipt1Id]);
              assertExists(entry.value);
              assertEquals(entry.value.status, "revoked");
              assertEquals(entry.value.revocation_reason, "SUPERSEDED");
              assertExists(entry.value.revoked_at);
            },
          );

          await t.step("second receipt is still active", async () => {
            assertExists(receipt2Id);
            const entry = await kv.get<{ status: string }>(
              ["receipts", receipt2Id],
            );
            assertExists(entry.value);
            assertEquals(entry.value.status, "active");
          });

          await t.step(
            "exactly one active receipt exists for that sender after superseding",
            async () => {
              const { result } = await callTool<{
                receipts: Array<{
                  id: string;
                  status: string;
                  sender_domain: string;
                }>;
              }>(token, "list_issued_receipts", { status: "active" });
              assertExists(result);
              const activeSender = result.receipts.filter(
                (r) => r.sender_domain === senderDomain,
              );
              assertEquals(activeSender.length, 1);
              assertEquals(activeSender[0].id, receipt2Id);
            },
          );

          await t.step(
            "invitation without domain_id claim does not supersede existing receipts",
            async () => {
              const inv3Id = crypto.randomUUID();
              await kv.set(["invitations", inv3Id], {
                invitation_id: inv3Id,
                receiver_oid: accountOid,
                sender_domain: "other.example",
                status: "pending",
                proposed_terms: { category: "billing" },
                // no claims — no domain_id
                created_at: new Date().toISOString(),
              });
              await callTool(token, "accept_invitation", {
                invitation_id: inv3Id,
              });

              // receipt2 must still be active — no superseding without domain_id
              assertExists(receipt2Id);
              const entry = await kv.get<{ status: string }>(
                ["receipts", receipt2Id],
              );
              assertExists(entry.value);
              assertEquals(entry.value.status, "active");
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
