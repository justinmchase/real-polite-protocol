import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";
import { seedOutboundInvitation } from "../helpers/seed-outbound-invitation.ts";
import { submitInvitationReplyEnvelope } from "../helpers/submit-invitation-reply-envelope.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { makeCredential, seedContact } from "../helpers/seed-contact.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name: "req:contacts-001 - Contact auto-creation on invitation acceptance",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool, baseUrl }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "User",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "local accept creates a contact with bilateral credentials",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const senderDomainId = crypto.randomUUID();
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain,
                  remoteDomainId: senderDomainId,
                });
                const { result } = await callTool<{
                  contact_id: string;
                }>(token, "accept_invitation", {
                  invitation_id: inv.invitation_id,
                  local_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                assertExists(result);
                const contact = await kv.get<Record<string, unknown>>([
                  "contacts",
                  ownerOid,
                  result.contact_id,
                ]);
                assertExists(contact.value);
                const c = contact.value as {
                  remote_domain: string;
                  remote_domain_id: string;
                  local_credential: { contact_id: string };
                  remote_credential: { contact_id: string };
                  local_terms: unknown;
                  remote_terms: unknown;
                  blocked: boolean;
                };
                assertEquals(c.remote_domain, remoteDomain);
                assertEquals(c.remote_domain_id, senderDomainId);
                assertExists(c.local_credential.contact_id);
                assertEquals(
                  c.remote_credential.contact_id,
                  inv.reply_credential.contact_id,
                );
                assertEquals(c.blocked, false);
                assertExists(c.local_terms);
                assertExists(c.remote_terms);
              });
            },
          );

          await t.step(
            "remote accept (inbound invitation_reply) creates a contact",
            async () => {
              const outbound = await seedOutboundInvitation(kv, {
                ownerOid,
                remoteDomain: "remote.example",
              });
              const remoteReply = makeCredential();
              const resp = await submitInvitationReplyEnvelope({
                invitationId: outbound.invitation_id,
                signingCredential: outbound.reply_credential,
                replyCredential: remoteReply,
                senderDomain: "remote.example",
                baseUrl,
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();

              const contacts: unknown[] = [];
              for await (
                const e of kv.list({
                  prefix: ["contacts_by_oid", ownerOid],
                })
              ) {
                contacts.push(e);
              }
              assertEquals(contacts.length >= 1, true);
            },
          );

          await t.step(
            "inbound message does NOT auto-create contact (rejected if no contact)",
            async () => {
              const unknownCred = makeCredential();
              const resp = await submitMessageEnvelope({
                credential: unknownCred,
                senderDomain: "stranger.example",
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "remote_domain + remote_domain_id pair is unique per OID",
            async () => {
              const sharedDomain = "dup.example";
              const sharedDomainId = crypto.randomUUID();
              await seedContact(kv, {
                ownerOid,
                remoteDomain: sharedDomain,
                remoteDomainId: sharedDomainId,
              });
              // Seed an inbound invitation that resolves to the same composite
              // key; acceptance should upsert in place, not create a duplicate.
              await withRemoteServer(async () => {
                const before: unknown[] = [];
                for await (
                  const e of kv.list({
                    prefix: ["contacts_by_domain_key", ownerOid, sharedDomain],
                  })
                ) {
                  before.push(e);
                }
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain: sharedDomain,
                  remoteDomainId: sharedDomainId,
                });
                const { result } = await callTool<{
                  contact_id: string;
                }>(token, "accept_invitation", {
                  invitation_id: inv.invitation_id,
                  local_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                assertExists(result);
                const after: unknown[] = [];
                for await (
                  const e of kv.list({
                    prefix: ["contacts_by_domain_key", ownerOid, sharedDomain],
                  })
                ) {
                  after.push(e);
                }
                // Same number of (domain,id) keys before and after.
                assertEquals(after.length, before.length);
              });
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
