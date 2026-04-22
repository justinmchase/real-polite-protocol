import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { submitMessage } from "../submit/test-helpers.ts";

Deno.test({
  name:
    "req:receipts-001 - Accepting an invitation issues and records a receipt",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });

          await callTool(token, "set_user_verified_metadata");

          const invitationId = crypto.randomUUID();
          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { category: "billing", max_content_rating: "G" },
            created_at: new Date().toISOString(),
          });

          let receiptId: string | undefined;
          let receiptSecret: string | undefined;

          await t.step(
            "accept_invitation response includes receipt credentials",
            async () => {
              const { status, result } = await callTool<{
                status: string;
                receipt?: {
                  id: string;
                  secret: string;
                  category: string;
                  max_content_rating: string;
                  usage_policy: string;
                  issued_at: string;
                };
              }>(token, "accept_invitation", { invitation_id: invitationId });

              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.status, "accepted");
              assertExists(result.receipt);
              assertExists(result.receipt.id);
              assertExists(result.receipt.secret);
              assertEquals(result.receipt.category, "billing");
              assertEquals(result.receipt.max_content_rating, "G");
              assertExists(result.receipt.issued_at);

              receiptId = result.receipt.id;
              receiptSecret = result.receipt.secret;
            },
          );

          await t.step("issued receipt is active in KV", async () => {
            assertExists(receiptId);
            const entry = await kv.get<{ id: string; status: string }>([
              "receipts",
              receiptId,
            ]);
            assertExists(entry.value);
            assertEquals(entry.value.id, receiptId);
            assertEquals(entry.value.status, "active");
          });

          await t.step(
            "issued receipt appears in list_issued_receipts",
            async () => {
              assertExists(receiptId);
              const { status, result } = await callTool<{
                receipts: Array<
                  { id: string; sender_domain: string; status: string }
                >;
                page_size: number;
              }>(token, "list_issued_receipts", {});

              assertEquals(status, 200);
              assertExists(result);
              const found = result.receipts.find((r) => r.id === receiptId);
              assertExists(found);
              assertEquals(found.sender_domain, "sender.example");
              assertEquals(found.status, "active");
            },
          );

          await t.step(
            "issued receipt can authenticate a submit request",
            async () => {
              assertExists(receiptId);
              assertExists(receiptSecret);

              const response = await submitMessage({
                receiptId,
                receiptSecret,
                baseUrl,
              });
              assertEquals(response.status, 202);
              await response.body?.cancel();
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
