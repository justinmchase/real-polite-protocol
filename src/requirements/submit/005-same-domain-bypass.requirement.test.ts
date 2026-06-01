// req:submit-005 — Envelope delivery bypasses outbound HTTP for same-domain recipients.
//
// When a tool delivers an envelope to the local domain itself, the server MUST
// invoke the local handler directly rather than calling
// POST /rpp/v1/envelopes on its own hostname (which Deno Deploy would refuse
// with HTTP 508 Loop Detected).
//
// This file exercises the three same-domain paths:
//   - send_invitation (outbound invitation)
//   - accept_invitation (outbound invitation_reply)
//   - send_message (outbound message)
//
// Same-domain is asserted by the fact that each tool succeeds against a target
// domain == the local test server's domain, with no remote stub registered.

import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";
import { seedContact } from "../helpers/seed-contact.ts";

Deno.test({
  name:
    "req:submit-005 - Envelope delivery bypasses outbound HTTP for same-domain recipients",
  fn: async (t) => {
    // Wrap fetch BEFORE the auth stub layers itself on top. Any
    // /rpp/v1/envelopes request made by the tools would still reach this
    // outer wrapper (the auth stub delegates to the previous fetch for
    // non-JWKS URLs). The same-domain short-circuit MUST prevent any such
    // request from ever being issued. Direct assignment (not @std stub) so
    // it can coexist with the auth helper's stub on top.
    const originalFetch = globalThis.fetch;
    let envelopeFetchCount = 0;
    globalThis.fetch = ((
      ...args: Parameters<typeof globalThis.fetch>
    ) => {
      const [input] = args;
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
      try {
        if (new URL(url).pathname === "/rpp/v1/envelopes") {
          envelopeFetchCount++;
        }
      } catch {
        // ignore non-URL inputs
      }
      return originalFetch(...args);
    }) as typeof globalThis.fetch;

    try {
      await withAuthTestContext(async ({ issueToken }) => {
        await withStartedServer(async ({ kvPath, port, callTool }) => {
          const kv = await Deno.openKv(kvPath);
          try {
            const localDomain = `localhost:${port}`;
            const userOid = crypto.randomUUID();
            const userToken = await issueToken({
              oid: userOid,
              scope: requiredScopes.join(" "),
              name: "User",
            });
            await callTool(userToken, "set_user_verified_metadata");

            await t.step(
              "send_invitation to local domain succeeds (no self-loop)",
              async () => {
                // Open a receptive window so there is a policy id to target.
                const peerOid = crypto.randomUUID();
                const peerToken = await issueToken({
                  oid: peerOid,
                  scope: requiredScopes.join(" "),
                  name: "Peer",
                });
                await callTool(peerToken, "set_user_verified_metadata");
                const { result: window } = await callTool<
                  { policy_id: string }
                >(peerToken, "open_receptive_window", {
                  duration_seconds: 300,
                });
                assertExists(window);

                const { status, result } = await callTool<
                  { invitation_id: string; created_at: string }
                >(userToken, "send_invitation", {
                  receiver_domain: localDomain,
                  receptive_policy_id: window!.policy_id,
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                assertEquals(status, 200);
                assertExists(result?.invitation_id);
                assertExists(result?.created_at);

                // Both the outbound (sender's view) and the inbound (receiver's
                // view) sides MUST exist in KV after the same-domain bypass.
                const outbound = await kv.get([
                  "invitations_by_owner",
                  userOid,
                  "outbound",
                  result!.invitation_id,
                ]);
                assertExists(outbound.value);
                const inbound = await kv.get([
                  "invitations_by_owner",
                  peerOid,
                  "inbound",
                  result!.invitation_id,
                ]);
                assertExists(inbound.value);
              },
            );

            await t.step(
              "accept_invitation against a same-domain inbound invitation succeeds (no self-loop on reply)",
              async () => {
                // Seed an outbound invitation owned by USER addressed at PEER
                // (so the same-domain accept reply has somewhere to land).
                const peer2Oid = crypto.randomUUID();
                const peer2Token = await issueToken({
                  oid: peer2Oid,
                  scope: requiredScopes.join(" "),
                  name: "Peer2",
                });
                await callTool(peer2Token, "set_user_verified_metadata");

                // Seed an inbound invitation directly into PEER2's KV so PEER2
                // can accept_invitation. The invitation must reference an
                // outbound side owned by USER (with a known reply_credential) so
                // the same-domain reply path can complete locally.
                const invitationId = crypto.randomUUID();
                const replyCred = {
                  contact_id: crypto.randomUUID(),
                  contact_secret: "s".repeat(32),
                };
                // Outbound side, owned by USER.
                const localDomainId = crypto.randomUUID();
                await kv.atomic()
                  .set(["invitations", userOid, invitationId], {
                    invitation_id: invitationId,
                    direction: "outbound",
                    owner_oid: userOid,
                    remote_domain: localDomain,
                    status: "pending",
                    communication_terms: {
                      categories: ["correspondence"],
                      max_content_rating: "PG",
                    },
                    reply_credential: replyCred,
                    claims: { immutable: { domain_id: localDomainId } },
                    sent_at: new Date(),
                    created_at: new Date(),
                  })
                  .set(
                    [
                      "invitations_by_owner",
                      userOid,
                      "outbound",
                      invitationId,
                    ],
                    invitationId,
                  )
                  .set(
                    ["invitations_by_id", invitationId, "outbound"],
                    userOid,
                  )
                  .commit();

                // Inbound side, owned by PEER2.
                await seedInboundInvitation(kv, {
                  ownerOid: peer2Oid,
                  invitationId,
                  remoteDomain: localDomain,
                  replyCredential: replyCred,
                });

                const { status } = await callTool(
                  peer2Token,
                  "accept_invitation",
                  {
                    invitation_id: invitationId,
                    local_terms: {
                      categories: ["correspondence"],
                      max_content_rating: "PG",
                    },
                  },
                );
                assertEquals(status, 200);

                // USER's outbound invitation should now be `accepted` (the
                // local-path reply handler ran the same transition the inbound
                // HTTP path would have).
                const outbound = await kv.get([
                  "invitations",
                  userOid,
                  invitationId,
                ]);
                assertExists(outbound.value);
                assertEquals(
                  (outbound.value as { status: string }).status,
                  "accepted",
                );
              },
            );

            await t.step(
              "send_message to a contact whose remote_domain == local domain succeeds (no self-loop)",
              async () => {
                // For same-domain delivery we must seed BOTH halves of the
                // bilateral contact relationship — USER's view of PEER (used
                // for outbound signing) AND PEER's view of USER (used by the
                // inbound handler to route the message).
                const peerSendOid = crypto.randomUUID();
                const peerSendToken = await issueToken({
                  oid: peerSendOid,
                  scope: requiredScopes.join(" "),
                  name: "PeerSend",
                });
                await callTool(peerSendToken, "set_user_verified_metadata");

                // Credentials, in PEER's frame of reference:
                //   - peerLocalCred: PEER issued to USER. USER uses to send
                //     outbound. PEER uses to verify inbound.
                //   - peerRemoteCred: USER issued to PEER.
                const peerLocalCred = {
                  contact_id: crypto.randomUUID(),
                  contact_secret: "p".repeat(32),
                };
                const peerRemoteCred = {
                  contact_id: crypto.randomUUID(),
                  contact_secret: "u".repeat(32),
                };

                // USER's contact for PEER.
                const userContact = await seedContact(kv, {
                  ownerOid: userOid,
                  remoteDomain: localDomain,
                  localCredential: peerRemoteCred,
                  remoteCredential: peerLocalCred,
                });

                // PEER's contact for USER (mirror image).
                await seedContact(kv, {
                  ownerOid: peerSendOid,
                  remoteDomain: localDomain,
                  localCredential: peerLocalCred,
                  remoteCredential: peerRemoteCred,
                });

                const { status, result } = await callTool<
                  { message_id: string; accepted: boolean }
                >(userToken, "send_message", {
                  contact_id: userContact.id,
                  category: "correspondence",
                  content_rating: "G",
                  body: { content_type: "text/markdown", content: "hi" },
                });
                assertEquals(status, 200);
                assertExists(result?.message_id);
                assertEquals(result!.accepted, true);
              },
            );
          } finally {
            kv.close();
          }
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assertEquals(
      envelopeFetchCount,
      0,
      `expected zero fetches to /rpp/v1/envelopes (same-domain bypass), got ${envelopeFetchCount}`,
    );
  },
});
