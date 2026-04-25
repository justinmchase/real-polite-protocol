import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:contacts-006 - invite_contact sends an invitation to a known contact",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const accountOid = crypto.randomUUID();
          const token = await issueToken({
            oid: accountOid,
            scope: requiredScopes.join(" "),
            name: "Test User",
          });
          await callTool(token, "set_user_verified_metadata");

          // The test server acts as both sender and receiver.
          // Seed an invitation from the test server itself so the resulting
          // contact has domain = "localhost:{port}".
          const receiverDomain = `localhost:${port}`;
          const senderDomainId = crypto.randomUUID();

          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: receiverDomain,
            status: "pending",
            proposed_terms: { category: "billing" },
            claims: { immutable: { domain_id: senderDomainId } },
            created_at: new Date().toISOString(),
          });
          await callTool(token, "accept_invitation", { invitation_id: invId });

          const { result: list } = await callTool<{
            contacts: Array<{ id: string }>;
          }>(token, "list_contacts", {});
          assertExists(list);
          const contactId = list.contacts[0]?.id;
          assertExists(contactId);

          // The receipt from acceptance gives us a receipt_id for the receipt-based path.
          const { result: receiptList } = await callTool<{
            receipts: Array<{ id: string; status: string }>;
          }>(token, "list_issued_receipts", { status: "active" });
          assertExists(receiptList);
          const receiptId = receiptList.receipts[0]?.id;
          assertExists(receiptId);

          // Open a receptive window so the policy-based invite path has a target.
          const { result: window } = await callTool<{ policy_id: string }>(
            token,
            "open_receptive_window",
            { duration_seconds: 300 },
          );
          assertExists(window);
          const policyId = window.policy_id;

          await t.step(
            "invite_contact with receptive_policy_id delivers the invitation",
            async () => {
              const { status, result } = await callTool<{
                invitation_id: string;
                created_at: string;
              }>(token, "invite_contact", {
                contact_id: contactId,
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
              });
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.invitation_id);
              assertExists(result.created_at);
            },
          );

          await t.step(
            "invite_contact with receipt_id delivers the invitation via receipt path",
            async () => {
              const { status, result } = await callTool<{
                invitation_id: string;
                created_at: string;
              }>(token, "invite_contact", {
                contact_id: contactId,
                receipt_id: receiptId,
                proposed_terms: { category: "support" },
              });
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.invitation_id);
            },
          );

          await t.step(
            "invite_contact with an unknown contact_id returns a structured error",
            async () => {
              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "invite_contact",
                {
                  contact_id: crypto.randomUUID(),
                  receptive_policy_id: policyId,
                  proposed_terms: { category: "billing" },
                },
              );
              assertExists(result);
              assertEquals((result as { ok?: boolean }).ok, false);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
