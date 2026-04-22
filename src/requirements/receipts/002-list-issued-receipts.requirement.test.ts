import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receipts-002 - Listeners can list receipts they have issued",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          await callTool(token, "set_user_verified_metadata");

          // Seed two invitations from different senders
          const invitationIdA = crypto.randomUUID();
          const invitationIdB = crypto.randomUUID();

          await kv.set(["invitations", invitationIdA], {
            invitation_id: invitationIdA,
            receiver_oid: accountOid,
            sender_domain: "alpha.example",
            status: "pending",
            proposed_terms: { categories: ["billing"] },
            created_at: new Date().toISOString(),
          });
          await kv.set(["invitations", invitationIdB], {
            invitation_id: invitationIdB,
            receiver_oid: accountOid,
            sender_domain: "beta.example",
            status: "pending",
            proposed_terms: { categories: ["general"] },
            created_at: new Date().toISOString(),
          });

          // Accept both invitations to issue receipts
          const { result: resultA } = await callTool<{
            receipt?: { id: string };
          }>(token, "accept_invitation", { invitation_id: invitationIdA });
          const { result: resultB } = await callTool<{
            receipt?: { id: string };
          }>(token, "accept_invitation", { invitation_id: invitationIdB });

          const receiptIdA = resultA?.receipt?.id;
          const receiptIdB = resultB?.receipt?.id;
          assertExists(receiptIdA);
          assertExists(receiptIdB);

          await t.step("list_issued_receipts returns all issued receipts for caller", async () => {
            const { status, result } = await callTool<{
              receipts: Array<{ id: string }>;
              page_size: number;
            }>(token, "list_issued_receipts", {});

            assertEquals(status, 200);
            assertExists(result);
            const ids = result.receipts.map((r) => r.id);
            assertEquals(ids.includes(receiptIdA), true);
            assertEquals(ids.includes(receiptIdB), true);
          });

          await t.step("list_issued_receipts filters by sender_domain", async () => {
            const { result } = await callTool<{
              receipts: Array<{ id: string; sender_domain: string }>;
            }>(token, "list_issued_receipts", { sender_domain: "alpha.example" });

            assertExists(result);
            assertEquals(result.receipts.every((r) => r.sender_domain === "alpha.example"), true);
            assertEquals(result.receipts.some((r) => r.id === receiptIdA), true);
            assertEquals(result.receipts.some((r) => r.id === receiptIdB), false);
          });

          await t.step("list_issued_receipts filters by status", async () => {
            const { result } = await callTool<{
              receipts: Array<{ id: string; status: string }>;
            }>(token, "list_issued_receipts", { status: "active" });

            assertExists(result);
            assertEquals(result.receipts.every((r) => r.status === "active"), true);
            assertEquals(result.receipts.some((r) => r.id === receiptIdA), true);
          });

          await t.step("receipts from other accounts are not visible", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other User",
            });
            await callTool(otherToken, "set_user_verified_metadata");

            const { result } = await callTool<{
              receipts: Array<{ id: string }>;
            }>(otherToken, "list_issued_receipts", {});

            assertExists(result);
            const ids = result.receipts.map((r) => r.id);
            assertEquals(ids.includes(receiptIdA), false);
            assertEquals(ids.includes(receiptIdB), false);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
