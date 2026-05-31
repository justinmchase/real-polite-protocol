import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name:
    "req:invitations-005 - Senders can send a direct invitation by receptive_policy_id",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "Sender",
          });
          await callTool(token, "set_user_verified_metadata");

          await t.step(
            "dispatches invitation envelope with receptive_policy_id and records outbound",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const policyId = crypto.randomUUID();
                const { status, result } = await callTool<{
                  invitation_id: string;
                  created_at: string;
                }>(token, "send_invitation", {
                  receiver_domain: remoteDomain,
                  receptive_policy_id: policyId,
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                  message: "Hello",
                });
                assertEquals(status, 200);
                assertExists(result);
                assertExists(result.invitation_id);

                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const call = calls[0];
                assertEquals(call.method, "POST");
                assertEquals(
                  call.headers["x-rpp-receptive-policy-id"],
                  policyId,
                );
                // Per req-005 path 1 there is no HMAC header on the
                // invitation envelope itself (policy id is the credential).
                assertEquals(
                  "x-rpp-signature" in call.headers,
                  false,
                );

                const env = call.body as Record<string, unknown>;
                assertEquals(env.category, "invitation");
                assertEquals(env.invitation_id, result.invitation_id);
                assertEquals(env.receptive_policy_id, policyId);
                assertExists(env.reply_credential);
                assertExists(env.communication_terms);
                assertExists(
                  (env.claims as { immutable: { domain_id: string } })
                    .immutable.domain_id,
                );

                // Outbound invitation record persisted as pending.
                const outbound = await kv.get<Record<string, unknown>>([
                  "invitations",
                  result.invitation_id as string,
                ]);
                assertExists(outbound.value);
                assertEquals(
                  (outbound.value as { direction: string }).direction,
                  "outbound",
                );
                assertEquals(
                  (outbound.value as { status: string }).status,
                  "pending",
                );
                // reply_credential persisted locally for inbound reply auth.
                assertExists(
                  (outbound.value as { reply_credential: unknown })
                    .reply_credential,
                );
              });
            },
          );

          await t.step(
            "dispatches invitation envelope using shortcode",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const shortcode = "ABCD1234";
                const { result } = await callTool<{
                  invitation_id: string;
                }>(token, "send_invitation", {
                  receiver_domain: remoteDomain,
                  shortcode,
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                assertExists(result);
                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const env = calls[0].body as Record<string, unknown>;
                assertEquals(env.shortcode, shortcode);
              });
            },
          );

          await t.step(
            "errors when both receptive_policy_id and shortcode are provided",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const { result, body } = await callTool(
                  token,
                  "send_invitation",
                  {
                    receiver_domain: remoteDomain,
                    receptive_policy_id: crypto.randomUUID(),
                    shortcode: "ABCD1234",
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

          await t.step(
            "errors when neither receptive_policy_id nor shortcode are provided",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const { result, body } = await callTool(
                  token,
                  "send_invitation",
                  {
                    receiver_domain: remoteDomain,
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
        } finally {
          kv.close();
        }
      });
    });
  },
});
