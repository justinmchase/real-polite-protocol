import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";
import { seedContact } from "../helpers/seed-contact.ts";

Deno.test({
  name: "req:contacts-006 - invite_contact tool",
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
            "dispatches invitation to contact's remote_domain with supplied policy",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const contact = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                });
                const policyId = crypto.randomUUID();
                const { status, result } = await callTool<{
                  invitation_id: string;
                  created_at: string;
                }>(token, "invite_contact", {
                  contact_id: contact.id,
                  receptive_policy_id: policyId,
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                  message: "Re-invite",
                });
                assertEquals(status, 200);
                assertExists(result);
                assertExists(result.invitation_id);

                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const call = calls[0];
                assertEquals(
                  call.headers["x-rpp-receptive-policy-id"],
                  policyId,
                );
                const env = call.body as Record<string, unknown>;
                assertEquals(env.category, "invitation");
                assertEquals(env.invitation_id, result.invitation_id);
                assertEquals(env.receptive_policy_id, policyId);
                // Fresh reply_credential, NOT the contact's local_credential.
                const envRc = env.reply_credential as { contact_id: string };
                assertEquals(
                  envRc.contact_id !== contact.local_credential.contact_id,
                  true,
                );

                // Outbound invitation persisted as pending.
                const outbound = await kv.get<Record<string, unknown>>([
                  "invitations",
                  ownerOid,
                  result.invitation_id,
                ]);
                assertExists(outbound.value);
                assertEquals(
                  (outbound.value as { remote_domain: string }).remote_domain,
                  remoteDomain,
                );
              });
            },
          );

          await t.step(
            "rejects when contact is blocked (E_CONTACT_BLOCKED)",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const contact = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                  blocked: true,
                });
                const { result, body } = await callTool(
                  token,
                  "invite_contact",
                  {
                    contact_id: contact.id,
                    receptive_policy_id: crypto.randomUUID(),
                    communication_terms: {
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

          await t.step("rejects when contact_id does not exist", async () => {
            const { result, body } = await callTool(token, "invite_contact", {
              contact_id: crypto.randomUUID(),
              receptive_policy_id: crypto.randomUUID(),
              communication_terms: {
                categories: ["correspondence"],
                max_content_rating: "PG",
              },
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });
        } finally {
          kv.close();
        }
      });
    });
  },
});
