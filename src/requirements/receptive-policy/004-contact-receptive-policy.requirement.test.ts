import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

// Contacts-mode receptive policy lets a listener accept invitations only from
// a pre-approved set of (domain, domain_id) pairs.

Deno.test({
  name:
    "req:receptive-policy-004 - Contact-mode receptive policy restricts senders by domain_id",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, port, callTool }) => {
        const kv = await Deno.openKv(kvPath);

        try {
          // Account A is the receiver.
          const receiverOid = crypto.randomUUID();
          const receiverToken = await issueToken({
            oid: receiverOid,
            scope: requiredScopes.join(" "),
            name: "Receiver",
          });
          await callTool(receiverToken, "set_user_verified_metadata");

          // Account B is the authorized sender.
          const senderOid = crypto.randomUUID();
          const senderToken = await issueToken({
            oid: senderOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(senderToken, "set_user_verified_metadata");

          // Read Account B's domain_id from KV.
          const meta = await kv.get<{
            immutable_fields?: Record<string, string>;
          }>(["accounts", "verified_metadata", senderOid]);
          const senderDomainId = meta.value?.immutable_fields?.domain_id;
          assertExists(
            senderDomainId,
            "sender should have a domain_id after set_user_verified_metadata",
          );

          const serverHost = `localhost:${port}`;

          let policyId: string | undefined;

          await t.step(
            "add_receptive_policy with mode=contact registers the policy",
            async () => {
              const { status, result } = await callTool<{ policy_id: string }>(
                receiverToken,
                "add_receptive_policy",
                {
                  mode: "contact",
                  contacts: [
                    { domain: serverHost, domain_id: senderDomainId },
                  ],
                },
              );
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.policy_id);
              policyId = result.policy_id;
            },
          );

          await t.step(
            "authorized sender with matching domain_id can send an invitation",
            async () => {
              assertExists(policyId);
              const { status, result } = await callTool<{
                invitation_id: string;
              }>(senderToken, "send_invitation", {
                receiver_domain: serverHost,
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
              });
              assertEquals(status, 200);
              assertExists(result);
              assertExists(result.invitation_id);
            },
          );

          await t.step(
            "sender with a different domain_id is rejected (E_RECEPTIVE_POLICY_CLOSED)",
            async () => {
              assertExists(policyId);
              // Create a third account whose domain_id is NOT in the contacts list.
              const unauthorizedOid = crypto.randomUUID();
              const unauthorizedToken = await issueToken({
                oid: unauthorizedOid,
                scope: requiredScopes.join(" "),
                name: "Unauthorized",
              });
              await callTool(unauthorizedToken, "set_user_verified_metadata");

              const { result } = await callTool<{
                ok?: boolean;
                code?: string;
              }>(unauthorizedToken, "send_invitation", {
                receiver_domain: serverHost,
                receptive_policy_id: policyId,
                proposed_terms: { category: "billing" },
              });
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
