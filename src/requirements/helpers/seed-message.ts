import { assertEquals, assertExists } from "@std/assert";
import { type ToolCallResult } from "./call-tool.ts";
import { submitMessage } from "./submit-message.ts";

export interface SeedMessageOptions {
  kv: Deno.Kv;
  callTool: <T>(
    token: string,
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<ToolCallResult<T>>;
  baseUrl: string;
  accountOid: string;
  token: string;
}

/**
 * Seeds a received message for the given account by creating a pending
 * invitation, accepting it to obtain a receipt, and submitting a message.
 * Returns the wire `message_id`.
 */
export async function seedMessage(
  opts: SeedMessageOptions,
): Promise<string> {
  const { kv, callTool, baseUrl, accountOid, token } = opts;

  const invId = crypto.randomUUID();
  await kv.set(["invitations", invId], {
    invitation_id: invId,
    receiver_oid: accountOid,
    sender_domain: "sender.example",
    status: "pending",
    proposed_terms: { category: "billing", max_content_rating: "G" },
    created_at: new Date().toISOString(),
  });

  const { result: acceptResult } = await callTool<{
    receipt?: { id: string; secret: string };
  }>(token, "accept_invitation", { invitation_id: invId });
  assertExists(acceptResult?.receipt?.id);
  const receiptId = acceptResult!.receipt!.id;
  const receiptSecret = acceptResult!.receipt!.secret;

  const messageId = crypto.randomUUID();
  const resp = await submitMessage({
    receiptId,
    receiptSecret,
    messageId,
    senderDomain: "sender.example",
    baseUrl,
  });
  assertEquals(resp.status, 202);
  await resp.body?.cancel();
  return messageId;
}
