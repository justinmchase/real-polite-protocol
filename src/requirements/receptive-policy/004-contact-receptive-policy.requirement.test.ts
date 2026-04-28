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

          await t.step(
            "domain matching is case-insensitive (uppercase domain in contacts matches lowercase sender)",
            async () => {
              // Add a new policy where the contact entry uses an uppercase domain.
              const upperHost = serverHost.toUpperCase();
              const { status: addStatus, result: ciPolicy } = await callTool<{
                policy_id: string;
              }>(receiverToken, "add_receptive_policy", {
                mode: "contact",
                contacts: [{ domain: upperHost, domain_id: senderDomainId }],
              });
              assertEquals(addStatus, 200);
              assertExists(ciPolicy);
              assertExists(ciPolicy?.policy_id);

              // Sender's envelope will have sender_domain === lowercase serverHost;
              // the server MUST still match the uppercase contact entry.
              const { status, result: inv } = await callTool<{
                invitation_id?: string;
                ok?: boolean;
              }>(senderToken, "send_invitation", {
                receiver_domain: serverHost,
                receptive_policy_id: ciPolicy!.policy_id,
                proposed_terms: { category: "billing" },
              });
              assertEquals(status, 200);
              assertExists(inv);
              assertExists(
                inv?.invitation_id,
                "invitation must succeed when domain differs only in case",
              );
            },
          );

          await t.step(
            "same domain_id from a different domain does not satisfy the contact entry",
            async () => {
              // Create a policy whose contact entry uses senderDomainId but with a
              // different domain.  The sender's actual domain is serverHost, so the
              // composite pair will not match and the invitation must be rejected.
              const { status: addStatus, result: diffPolicy } = await callTool<{
                policy_id: string;
              }>(receiverToken, "add_receptive_policy", {
                mode: "contact",
                contacts: [
                  { domain: "other.example.test", domain_id: senderDomainId },
                ],
              });
              assertEquals(addStatus, 200);
              assertExists(diffPolicy);
              assertExists(diffPolicy?.policy_id);

              const { result: inv } = await callTool<{
                ok?: boolean;
                code?: string;
              }>(senderToken, "send_invitation", {
                receiver_domain: serverHost,
                receptive_policy_id: diffPolicy!.policy_id,
                proposed_terms: { category: "billing" },
              });
              assertExists(inv);
              assertEquals(
                (inv as { ok?: boolean }).ok,
                false,
                "invitation from a different domain must be rejected even when domain_id matches",
              );
            },
          );

          await t.step(
            "domain_id matching is exact (one-character difference is rejected)",
            async () => {
              assertExists(senderDomainId);
              // Produce a domain_id that differs from the sender's by exactly one character.
              const lastChar = senderDomainId[senderDomainId.length - 1];
              const altChar = lastChar === "a" ? "b" : "a";
              const wrongDomainId = senderDomainId.slice(0, -1) + altChar;

              const { status: addStatus, result: exactPolicy } = await callTool<
                { policy_id: string }
              >(receiverToken, "add_receptive_policy", {
                mode: "contact",
                contacts: [{ domain: serverHost, domain_id: wrongDomainId }],
              });
              assertEquals(addStatus, 200);
              assertExists(exactPolicy);
              assertExists(exactPolicy?.policy_id);

              // senderToken carries the original senderDomainId, which does NOT match wrongDomainId.
              const { result: inv } = await callTool<{ ok?: boolean }>(
                senderToken,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: exactPolicy!.policy_id,
                  proposed_terms: { category: "billing" },
                },
              );
              assertExists(inv);
              assertEquals(
                (inv as { ok?: boolean }).ok,
                false,
                "invitation must be rejected when domain_id differs by a single character",
              );
            },
          );

          await t.step(
            "contacts list is immutable: removing and recreating yields a new policy_id",
            async () => {
              assertExists(policyId);
              // Remove the original policy — the only way to change contacts.
              const { status: removeStatus } = await callTool(
                receiverToken,
                "remove_receptive_policy",
                { policy_id: policyId },
              );
              assertEquals(removeStatus, 200);

              // Recreate with the same contacts list — the replacement MUST have a new policy_id.
              const { status: addStatus, result: newPolicy } = await callTool<{
                policy_id: string;
              }>(receiverToken, "add_receptive_policy", {
                mode: "contact",
                contacts: [
                  { domain: serverHost, domain_id: senderDomainId },
                ],
              });
              assertEquals(addStatus, 200);
              assertExists(newPolicy);
              assertExists(newPolicy?.policy_id);
              assertEquals(
                newPolicy!.policy_id !== policyId,
                true,
                "replacement contact policy must receive a new policy_id",
              );
              // Original policy_id is now gone; using it must fail.
              const { result: staleInv } = await callTool<{ ok?: boolean }>(
                senderToken,
                "send_invitation",
                {
                  receiver_domain: serverHost,
                  receptive_policy_id: policyId,
                  proposed_terms: { category: "billing" },
                },
              );
              assertExists(staleInv);
              assertEquals(
                (staleInv as { ok?: boolean }).ok,
                false,
                "old policy_id must be rejected after delete-and-recreate",
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
