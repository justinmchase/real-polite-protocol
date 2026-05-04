// req:messages-009 — send_message validates reply_invite.receptive_policy_id.
//
// Tests here verify that when the caller supplies a reply_invite, the
// send_message tool rejects unknown or foreign-owned receptive_policy_id
// values locally with E_INVALID_REPLY_INVITE before any HTTP delivery, and
// accepts a valid policy owned by the caller (forwarding the reply_invite in
// the outbound envelope).

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withCallbackServer } from "../helpers/with-callback-server.ts";

Deno.test({
  name:
    "req:messages-009 - send_message validates reply_invite.receptive_policy_id",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          const callerOid = crypto.randomUUID();
          const callerToken = await issueToken({
            oid: callerOid,
            scope: requiredScopes.join(" "),
            name: "Caller",
          });
          await callTool(callerToken, "set_user_verified_metadata");

          const otherOid = crypto.randomUUID();
          const otherToken = await issueToken({
            oid: otherOid,
            scope: requiredScopes.join(" "),
            name: "Other Account",
          });
          await callTool(otherToken, "set_user_verified_metadata");

          await withCallbackServer(async (receiverDomain, getCaptures) => {
            // Seed a pending invitation from the receiver and accept it so
            // the caller holds a usable receipt.
            const invId = crypto.randomUUID();
            await kv.set(["invitations", invId], {
              invitation_id: invId,
              receiver_oid: callerOid,
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
            }>(callerToken, "accept_invitation", { invitation_id: invId });
            assertExists(acceptResult?.receipt?.id);
            const receiptId = acceptResult!.receipt!.id;

            // Open a receptive policy owned by the caller (valid reply target).
            const { result: callerWindow } = await callTool<{
              policy_id: string;
            }>(callerToken, "open_receptive_window", {
              duration_seconds: 300,
            });
            assertExists(callerWindow?.policy_id);
            const callerPolicyId = callerWindow!.policy_id;

            // Open a receptive policy owned by a different account.
            const { result: otherWindow } = await callTool<{
              policy_id: string;
            }>(otherToken, "open_receptive_window", {
              duration_seconds: 300,
            });
            assertExists(otherWindow?.policy_id);
            const otherPolicyId = otherWindow!.policy_id;

            await t.step(
              "rejects reply_invite whose policy_id does not exist",
              async () => {
                const fakePolicyId = crypto.randomUUID();
                const before = getCaptures().length;
                const { result } = await callTool<{
                  ok?: boolean;
                  error?: { code?: string };
                }>(callerToken, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                  reply_invite: { receptive_policy_id: fakePolicyId },
                });
                assertEquals((result as { ok?: boolean })?.ok, false);
                assertEquals(
                  (result as { error?: { code?: string } })?.error?.code,
                  "E_INVALID_REPLY_INVITE",
                );
                // No outbound delivery should have been attempted.
                assertEquals(getCaptures().length, before);
              },
            );

            await t.step(
              "rejects reply_invite whose policy is owned by another account",
              async () => {
                const before = getCaptures().length;
                const { result } = await callTool<{
                  ok?: boolean;
                  error?: { code?: string };
                }>(callerToken, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                  reply_invite: { receptive_policy_id: otherPolicyId },
                });
                assertEquals((result as { ok?: boolean })?.ok, false);
                assertEquals(
                  (result as { error?: { code?: string } })?.error?.code,
                  "E_INVALID_REPLY_INVITE",
                );
                assertEquals(getCaptures().length, before);
              },
            );

            await t.step(
              "accepts reply_invite whose policy is owned by the caller and forwards it",
              async () => {
                const { status, result } = await callTool<{
                  message_id: string;
                }>(callerToken, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                  reply_invite: { receptive_policy_id: callerPolicyId },
                });
                assertEquals(status, 200);
                assertExists(result?.message_id);

                const captures = getCaptures();
                const last = captures[captures.length - 1];
                assertExists(last);
                const envelope = last.body as {
                  reply_invite?: { receptive_policy_id?: string };
                };
                assertExists(envelope.reply_invite);
                assertEquals(
                  envelope.reply_invite!.receptive_policy_id,
                  callerPolicyId,
                );
              },
            );

            await t.step(
              "send_message without reply_invite is unaffected",
              async () => {
                const { status, result } = await callTool<{
                  message_id: string;
                }>(callerToken, "send_message", {
                  receipt_id: receiptId,
                  category: "billing",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                });
                assertEquals(status, 200);
                assertExists(result?.message_id);
                const captures = getCaptures();
                const last = captures[captures.length - 1];
                assertExists(last);
                const envelope = last.body as {
                  reply_invite?: unknown;
                };
                assertEquals(envelope.reply_invite, undefined);
              },
            );
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
