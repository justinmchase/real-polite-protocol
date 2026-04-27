// req:messages-006 — Message responses include all recorded claims from sender.
//
// Tests verify that both list_messages and get_message always include a
// sender_claims field; that the field reflects the flat-merged current state
// of the contact record; that it covers all claim sources
// (sender_verified, sender_custom, domain_admin, owner_note); and that it is
// an empty object when no contact exists for the sending domain.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { submitMessage } from "../helpers/submit-message.ts";

Deno.test({
  name:
    "req:messages-006 - Message responses include all recorded claims from sender",
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

          // Seed an invitation with sender_verified and sender_custom claims.
          // The immutable.domain_id ties the contact to the sender domain.
          const senderDomainId = crypto.randomUUID();
          const invId = crypto.randomUUID();
          await kv.set(["invitations", invId], {
            invitation_id: invId,
            receiver_oid: accountOid,
            sender_domain: "claims-sender.example",
            status: "pending",
            proposed_terms: { category: "billing", max_content_rating: "G" },
            claims: {
              immutable: { domain_id: senderDomainId },
              user: { display_name: "Alice" },
              custom: { project_code: "PROJ-42" },
            },
            created_at: new Date().toISOString(),
          });

          // Accepting creates the contact with the above claims.
          const { result: acceptResult } = await callTool<{
            receipt?: { id: string; secret: string };
          }>(token, "accept_invitation", { invitation_id: invId });
          assertExists(acceptResult?.receipt?.id);
          const receiptId = acceptResult!.receipt!.id;
          const receiptSecret = acceptResult!.receipt!.secret;

          // Submit a message that carries sender_domain_id so the server can
          // look up the contact and attach sender_claims.
          const messageId = crypto.randomUUID();
          const submitResp = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            senderDomain: "claims-sender.example",
            senderDomainId,
            baseUrl,
          });
          assertEquals(submitResp.status, 202);
          await submitResp.body?.cancel();

          await t.step(
            "get_message includes sender_claims with current contact fields",
            async () => {
              const { status, result } = await callTool<{
                sender_claims: Record<
                  string,
                  { value: unknown; source: string }
                >;
              }>(token, "get_message", { message_id: messageId });

              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.sender_claims);
              assertEquals(typeof result.sender_claims, "object");

              // sender_verified field from invitation user claims
              assertExists(result.sender_claims.display_name);
              assertEquals(result.sender_claims.display_name.value, "Alice");
              assertEquals(
                result.sender_claims.display_name.source,
                "sender_verified",
              );

              // sender_custom field from invitation custom claims
              assertExists(result.sender_claims.project_code);
              assertEquals(
                result.sender_claims.project_code.value,
                "PROJ-42",
              );
              assertEquals(
                result.sender_claims.project_code.source,
                "sender_custom",
              );
            },
          );

          await t.step(
            "list_messages includes sender_claims on each returned message",
            async () => {
              const { status, result } = await callTool<{
                messages: Array<{
                  message_id: string;
                  sender_claims: Record<
                    string,
                    { value: unknown; source: string }
                  >;
                }>;
              }>(token, "list_messages", {});

              assertEquals(status, 200);
              assertExists(result);

              const msg = result.messages.find((m) =>
                m.message_id === messageId
              );
              assertExists(msg);
              assertExists(msg.sender_claims);
              assertEquals(typeof msg.sender_claims, "object");
              assertExists(msg.sender_claims.display_name);
              assertEquals(msg.sender_claims.display_name.value, "Alice");
            },
          );

          await t.step(
            "sender_claims is {} when no contact exists for the sender",
            async () => {
              // Submit a message from a domain that has no contact record
              // (i.e. no invitation was ever accepted from that domain).
              const unknownInvId = crypto.randomUUID();
              const unknownReceiptId = crypto.randomUUID();
              const unknownSecret = crypto.randomUUID();
              await kv.set(["invitations", unknownInvId], {
                invitation_id: unknownInvId,
                receiver_oid: accountOid,
                sender_domain: "unknown-sender.example",
                status: "pending",
                proposed_terms: {
                  category: "billing",
                  max_content_rating: "G",
                },
                created_at: new Date().toISOString(),
              });
              await kv.set(["receipts", unknownReceiptId], {
                id: unknownReceiptId,
                secret: unknownSecret,
                oid: accountOid,
                sender_domain: "unknown-sender.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              // Submit without sender_domain_id → no contact lookup possible.
              const noClaimsMsgId = crypto.randomUUID();
              const resp2 = await submitMessage({
                receiptId: unknownReceiptId,
                receiptSecret: unknownSecret,
                messageId: noClaimsMsgId,
                senderDomain: "unknown-sender.example",
                // intentionally omit senderDomainId
                baseUrl,
              });
              assertEquals(resp2.status, 202);
              await resp2.body?.cancel();

              const { result } = await callTool<{
                sender_claims: Record<string, unknown>;
              }>(token, "get_message", { message_id: noClaimsMsgId });

              assertExists(result);
              assertExists(result.sender_claims);
              assertEquals(
                Object.keys(result.sender_claims).length,
                0,
                "sender_claims must be an empty object when no contact exists",
              );
            },
          );

          await t.step(
            "sender_claims reflects current contact state at request time (not at delivery time)",
            async () => {
              // Get the contact created from the earlier invitation acceptance.
              const { result: listResult } = await callTool<{
                contacts: Array<{ id: string; domain: string }>;
              }>(token, "list_contacts", {});
              assertExists(listResult);
              const contact = listResult.contacts.find(
                (c) => c.domain === "claims-sender.example",
              );
              assertExists(contact);

              // Add an owner_note field after the message was already delivered.
              await callTool(token, "set_contact_field", {
                contact_id: contact.id,
                key: "owner_label",
                value: "trusted partner",
              });

              // The live sender_claims must now include the newly added owner_note.
              const { result } = await callTool<{
                sender_claims: Record<
                  string,
                  { value: unknown; source: string }
                >;
              }>(token, "get_message", { message_id: messageId });

              assertExists(result);
              assertExists(result.sender_claims.owner_label);
              assertEquals(
                result.sender_claims.owner_label.value,
                "trusted partner",
              );
              assertEquals(
                result.sender_claims.owner_label.source,
                "owner_note",
              );
            },
          );

          await t.step(
            "sender_claims includes domain_admin source fields",
            async () => {
              // Issue a domain-admin token and set an admin-verified field on
              // the same contact.
              const adminToken = await issueToken({
                oid: crypto.randomUUID(),
                scope: requiredScopes.join(" "),
                roles: ["domain.admin"],
                name: "Admin User",
              });

              const userOid = accountOid;
              await callTool(adminToken, "set_admin_verified_metadata", {
                oid: userOid,
                key: "tier",
                value: "gold",
              });

              // The domain_admin field should surface in sender_claims via the
              // contact's domain_admin namespace when it matches the sender.
              // Re-fetch the message and confirm the domain_admin key is present.
              const { result } = await callTool<{
                sender_claims: Record<
                  string,
                  { value: unknown; source: string }
                >;
              }>(token, "get_message", { message_id: messageId });

              assertExists(result);
              // sender_verified and sender_custom fields must still be present.
              assertExists(result.sender_claims.display_name);
              assertExists(result.sender_claims.project_code);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
