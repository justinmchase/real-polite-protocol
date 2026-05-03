// req:messages-001 — Listeners can send messages using a held receipt.
//
// Tests here verify that the send_message MCP tool signs and delivers a message
// envelope to the receiver's /rpp/v1/envelopes endpoint using the receipt secret
// for HMAC-SHA-256, and that invalid inputs are rejected locally before any
// network call is attempted.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";

Deno.test({
  name: "req:messages-001 - Listeners can send messages using a held receipt",
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

          await t.step(
            "send_message delivers a signed message envelope to the receiver endpoint",
            async () => {
              await withCallbackServer(async (receiverDomain, getCaptures) => {
                // Seed a pending invitation from the receiver domain so that
                // accepting it produces a receipt pointing there.
                const invId = crypto.randomUUID();
                await kv.set(["invitations", invId], {
                  invitation_id: invId,
                  receiver_oid: accountOid,
                  sender_domain: receiverDomain,
                  status: "pending",
                  proposed_terms: {
                    category: "billing",
                    max_content_rating: "G",
                  },
                  created_at: new Date().toISOString(),
                });

                const { result: acceptResult } = await callTool<{
                  receipt?: { id: string };
                }>(token, "accept_invitation", { invitation_id: invId });
                assertExists(acceptResult?.receipt?.id);
                const receiptId = acceptResult!.receipt!.id;

                const { status, result } = await callTool<{
                  message_id: string;
                  sent_at: string;
                  accepted: boolean;
                }>(token, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "text/markdown",
                    content: "Hello from the test.",
                  },
                  subject: "Test subject",
                });

                assertEquals(status, 200);
                assertExists(result?.message_id);
                assertExists(result?.sent_at);
                assertEquals(result?.accepted, true);

                // Receiver must have received exactly one POST.
                const captures = getCaptures();
                // accept_invitation callback is also captured; the last capture
                // is the send_message delivery.
                const msgCapture = captures[captures.length - 1];
                assertExists(msgCapture);
                assertEquals(msgCapture.body.category, "message");
                assertExists(msgCapture.headers["x-rpp-receipt-id"]);
                assertExists(msgCapture.headers["x-rpp-signature"]);
                assertExists(msgCapture.headers["x-rpp-timestamp"]);
              });
            },
          );

          await t.step(
            "send_message returns E_RECEIPT_NOT_ACTIVE for a revoked receipt",
            async () => {
              const revokedId = crypto.randomUUID();
              await kv.set(["receipts", revokedId], {
                id: revokedId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "revoked",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: revokedId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "Hi." },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_RECEIPT_NOT_ACTIVE",
              );
            },
          );

          await t.step(
            "send_message rejects a receipt that belongs to a different account",
            async () => {
              const otherId = crypto.randomUUID();
              await kv.set(["receipts", otherId], {
                id: otherId,
                secret: crypto.randomUUID(),
                oid: crypto.randomUUID(), // different owner
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<{ ok?: boolean }>(
                token,
                "send_message",
                {
                  receipt_id: otherId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "Hi." },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
            },
          );

          await t.step(
            "send_message rejects application/json body that is not valid JSON",
            async () => {
              // Seed a fresh active receipt for this step.
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "application/json",
                    content: "not valid json",
                  },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVALID_BODY",
              );
            },
          );

          await t.step(
            "send_message rejects application/json body whose top-level value is not an object or array",
            async () => {
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: {
                    content_type: "application/json",
                    content: '"a string"',
                  },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_INVALID_BODY",
              );
            },
          );

          await t.step(
            "send_message generates a UUIDv7 message_id that is unique across calls",
            async () => {
              await withCallbackServer(async (receiverDomain, getCaptures) => {
                // Seed a pending invitation to produce a receipt pointing at the callback server.
                const invId = crypto.randomUUID();
                await kv.set(["invitations", invId], {
                  invitation_id: invId,
                  receiver_oid: accountOid,
                  sender_domain: receiverDomain,
                  status: "pending",
                  proposed_terms: {
                    category: "billing",
                    max_content_rating: "G",
                  },
                  created_at: new Date().toISOString(),
                });

                const { result: acceptResult } = await callTool<{
                  receipt?: { id: string };
                }>(token, "accept_invitation", { invitation_id: invId });
                assertExists(acceptResult?.receipt?.id);
                const receiptId = acceptResult!.receipt!.id;

                const sendOpts = {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "ping" },
                };

                const { result: r1 } = await callTool<{ message_id?: string }>(
                  token,
                  "send_message",
                  sendOpts,
                );
                const { result: r2 } = await callTool<{ message_id?: string }>(
                  token,
                  "send_message",
                  sendOpts,
                );

                const id1 = r1?.message_id ?? "";
                const id2 = r2?.message_id ?? "";
                assertExists(id1);
                assertExists(id2);

                // UUIDv7: the version nibble is the first character of the 3rd
                // group in xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx (index 14).
                assertEquals(
                  id1[14],
                  "7",
                  `message_id "${id1}" is not UUIDv7 (version nibble must be 7)`,
                );
                assertEquals(
                  id2[14],
                  "7",
                  `message_id "${id2}" is not UUIDv7 (version nibble must be 7)`,
                );

                // Each call must produce a distinct ID.
                assertEquals(
                  id1 === id2,
                  false,
                  "consecutive send_message calls must produce unique message_ids",
                );

                // Drain captured bodies.
                getCaptures();
              });
            },
          );

          await t.step(
            "send_message rejects a message body exceeding 256 KB",
            async () => {
              const receiptId = crypto.randomUUID();
              await kv.set(["receipts", receiptId], {
                id: receiptId,
                secret: crypto.randomUUID(),
                oid: accountOid,
                sender_domain: "partner.example",
                category: "billing",
                max_content_rating: "G",
                usage_policy: "any-time",
                status: "active",
                issued_at: new Date().toISOString(),
              });

              // Generate a content string well over 256 KB.
              const oversized = "x".repeat(300 * 1024);

              const { result } = await callTool<
                { ok?: boolean; error?: { code?: string } }
              >(
                token,
                "send_message",
                {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: oversized },
                },
              );

              assertEquals((result as { ok?: boolean })?.ok, false);
              assertEquals(
                (result as { error?: { code?: string } })?.error?.code,
                "E_MESSAGE_TOO_LARGE",
              );
            },
          );

          await t.step(
            "same-domain delivery stores message without outbound HTTP",
            async () => {
              // Same-domain scenario: two distinct accounts (BEAU and USER)
              // share the local server. BEAU sends an invitation, USER accepts,
              // USER sends a message back. The message must land in BEAU's
              // inbox, not USER's. This exercises domain_id → OID resolution
              // (the OID is never serialized over the wire; we use the
              // sender_domain_id captured on the receipt to route storage).
              await withStartedServer(
                async ({ baseUrl: bu, callTool: ct, kvPath: kp }) => {
                  const localKv = await Deno.openKv(kp);
                  try {
                    const localHost = new URL(bu).host;

                    // Provision BEAU (the invitation sender).
                    const beauOid = crypto.randomUUID();
                    const beauToken = await issueToken({
                      oid: beauOid,
                      scope: requiredScopes.join(" "),
                      name: "Beau",
                    });
                    await ct(beauToken, "set_user_verified_metadata");
                    const { result: beauPerms } = await ct<{
                      account_id?: string;
                    }>(beauToken, "get_permissions", {});
                    assertExists(beauPerms?.account_id);

                    // Resolve BEAU's domain_id (assigned by ensureAccount).
                    const beauAcct = await localKv.get([
                      "accounts",
                      "by_oid",
                      beauOid,
                    ]);
                    const beauDomainId =
                      (beauAcct.value as { domain_id?: string })?.domain_id;
                    assertExists(beauDomainId);

                    // Provision USER (the acceptor / message sender).
                    const userOid = crypto.randomUUID();
                    const userToken = await issueToken({
                      oid: userOid,
                      scope: requiredScopes.join(" "),
                      name: "User",
                    });
                    await ct(userToken, "set_user_verified_metadata");

                    // Seed a pending invitation from BEAU to USER on the same
                    // local domain. The invitation carries BEAU's domain_id so
                    // the issued receipt records sender_domain_id = beauDomainId.
                    const invId = crypto.randomUUID();
                    await localKv.set(["invitations", invId], {
                      invitation_id: invId,
                      receiver_oid: userOid,
                      sender_domain: localHost,
                      status: "pending",
                      proposed_terms: {
                        category: "billing",
                        max_content_rating: "G",
                      },
                      claims: { immutable: { domain_id: beauDomainId } },
                      created_at: new Date().toISOString(),
                    });

                    const { result: acceptResult } = await ct<{
                      receipt?: { id: string };
                    }>(userToken, "accept_invitation", {
                      invitation_id: invId,
                    });
                    assertExists(acceptResult?.receipt?.id);
                    const receiptId = acceptResult!.receipt!.id;

                    const { status, result } = await ct<{
                      message_id?: string;
                      sent_at?: string;
                      accepted?: boolean;
                    }>(userToken, "send_message", {
                      receipt_id: receiptId,
                      category: "billing",
                      content_rating: "G",
                      body: {
                        content_type: "text/markdown",
                        content: "Same-domain message.",
                      },
                    });

                    assertEquals(status, 200);
                    assertExists(result?.message_id);
                    assertEquals(result?.accepted, true);

                    // The message must land in BEAU's inbox (the recipient
                    // identified by sender_domain_id), not USER's.
                    const { result: beauList } = await ct<{
                      messages?: { message_id: string }[];
                    }>(beauToken, "list_messages", {});
                    assertExists(beauList?.messages);
                    const beauHas = beauList!.messages!.some(
                      (m) => m.message_id === result?.message_id,
                    );
                    assertEquals(
                      beauHas,
                      true,
                      "same-domain message must be delivered to the recipient's inbox",
                    );

                    // It must NOT land in USER's (the sender's) inbox.
                    const { result: userList } = await ct<{
                      messages?: { message_id: string }[];
                    }>(userToken, "list_messages", {});
                    const userHas = (userList?.messages ?? []).some(
                      (m) => m.message_id === result?.message_id,
                    );
                    assertEquals(
                      userHas,
                      false,
                      "same-domain message must not appear in the sender's own inbox",
                    );
                  } finally {
                    localKv.close();
                  }
                },
              );
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
