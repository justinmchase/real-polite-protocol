import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedInboundInvitation } from "../helpers/seed-inbound-invitation.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";
import { computeHmac } from "../helpers/compute-hmac.ts";

Deno.test({
  name: "req:invitations-003 - Listeners can accept a pending invitation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
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
            "accept dispatches HMAC-signed invitation_reply and creates a contact",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const { status, result } = await callTool<{
                  invitation: { status: string; invitation_id: string };
                  contact_id: string;
                }>(token, "accept_invitation", {
                  invitation_id: inv.invitation_id,
                  local_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                  message: "Glad to meet.",
                });
                assertEquals(status, 200);
                assertExists(result);
                assertEquals(result.invitation.status, "accepted");
                assertExists(result.contact_id);

                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const call = calls[0];
                assertEquals(call.method, "POST");
                // Identity header uses the inbound reply_credential.contact_id
                assertEquals(
                  call.headers["x-rpp-contact-id"],
                  inv.reply_credential.contact_id,
                );
                // HMAC was signed with reply_credential.contact_secret
                const expected = await computeHmac(
                  inv.reply_credential.contact_secret,
                  call.headers["x-rpp-timestamp"],
                  call.bodyBytes,
                );
                assertEquals(call.headers["x-rpp-signature"], expected);
                const env = call.body as Record<string, unknown>;
                assertEquals(env.category, "invitation_reply");
                assertEquals(env.invitation_id, inv.invitation_id);
                assertExists(env.reply_credential);
                assertExists(env.communication_terms);
                assertEquals(env.message, "Glad to meet.");

                // Contact was created with bilateral credentials and terms.
                const contact = await kv.get<Record<string, unknown>>([
                  "contacts",
                  ownerOid,
                  result.contact_id,
                ]);
                assertExists(contact.value);
                assertEquals(
                  (contact.value as { remote_domain: string }).remote_domain,
                  remoteDomain,
                );
              });
            },
          );

          await t.step(
            "accept of non-pending invitation errors",
            async () => {
              const inv = await seedInboundInvitation(kv, {
                ownerOid,
                status: "rejected",
              });
              const { result, body } = await callTool(
                token,
                "accept_invitation",
                {
                  invitation_id: inv.invitation_id,
                  local_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "another account cannot accept this invitation",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const inv = await seedInboundInvitation(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const otherOid = crypto.randomUUID();
                const otherToken = await issueToken({
                  oid: otherOid,
                  scope: requiredScopes.join(" "),
                  name: "Other",
                });
                await callTool(otherToken, "set_user_verified_metadata");
                const { result, body } = await callTool(
                  otherToken,
                  "accept_invitation",
                  {
                    invitation_id: inv.invitation_id,
                    local_terms: {
                      categories: ["correspondence"],
                      max_content_rating: "PG",
                    },
                  },
                );
                const errorish =
                  (result as { ok?: boolean } | undefined)?.ok === false ||
                  body.error !== undefined || result === undefined;
                assertEquals(errorish, true);
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
