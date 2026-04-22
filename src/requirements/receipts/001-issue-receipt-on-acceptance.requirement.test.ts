import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receipts-001 - Accepting an invitation issues and records a receipt",
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

          const invitationId = crypto.randomUUID();
          await kv.set(["invitations", invitationId], {
            invitation_id: invitationId,
            receiver_oid: accountOid,
            sender_domain: "sender.example",
            status: "pending",
            proposed_terms: { categories: ["billing"], max_content_rating: "G" },
            created_at: new Date().toISOString(),
          });

          let receiptId: string | undefined;
          let receiptSecret: string | undefined;

          await t.step("accept_invitation response includes receipt credentials", async () => {
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
          });

          await t.step("issued receipt is active in KV", async () => {
            assertExists(receiptId);
            const entry = await kv.get<{ id: string; status: string }>(["receipts", receiptId]);
            assertExists(entry.value);
            assertEquals(entry.value.id, receiptId);
            assertEquals(entry.value.status, "active");
          });

          await t.step("issued receipt appears in list_issued_receipts", async () => {
            assertExists(receiptId);
            const { status, result } = await callTool<{
              receipts: Array<{ id: string; sender_domain: string; status: string }>;
              page_size: number;
            }>(token, "list_issued_receipts", {});

            assertEquals(status, 200);
            assertExists(result);
            const found = result.receipts.find((r) => r.id === receiptId);
            assertExists(found);
            assertEquals(found.sender_domain, "sender.example");
            assertEquals(found.status, "active");
          });

          await t.step("issued receipt can authenticate a submit request", async () => {
            assertExists(receiptId);
            assertExists(receiptSecret);

            const bodyJson = JSON.stringify({
              message_id: crypto.randomUUID(),
              sender_domain: "sender.example",
              category: "message",
              sent_at: new Date().toISOString(),
              message: {
                content_rating: "G",
                subject: "Test",
                body: { content_type: "text/markdown", content: "Hello." },
              },
            });
            const bodyBytes = new TextEncoder().encode(bodyJson);
            const timestamp = new Date().toISOString();

            const key = new TextEncoder().encode(receiptSecret);
            const prefix = new TextEncoder().encode(`${timestamp}.`);
            const cryptoKey = await crypto.subtle.importKey(
              "raw",
              key,
              { name: "HMAC", hash: "SHA-256" },
              false,
              ["sign"],
            );
            const combined = new Uint8Array(prefix.length + bodyBytes.length);
            combined.set(prefix, 0);
            combined.set(bodyBytes, prefix.length);
            const sig = await crypto.subtle.sign("HMAC", cryptoKey, combined);
            const signature = Array.from(new Uint8Array(sig))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            const response = await fetch("http://localhost:8000/rpp/v1/messages", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-rpp-receipt-id": receiptId,
                "x-rpp-signature": signature,
                "x-rpp-timestamp": timestamp,
              },
              body: bodyJson,
            });
            assertEquals(response.status, 202);
            await response.body?.cancel();
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
