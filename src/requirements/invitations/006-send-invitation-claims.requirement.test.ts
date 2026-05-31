import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name: "req:invitations-006 - Senders can attach verified and custom claims",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
        const kv = await Deno.openKv(kvPath);
        try {
          const ownerOid = crypto.randomUUID();
          const token = await issueToken({
            oid: ownerOid,
            scope: requiredScopes.join(" "),
            name: "Alice Smith",
            email: "alice@sender.example",
          });
          await callTool(token, "set_user_verified_metadata");

          // Set an admin-verified field via admin tool? Use direct KV write
          // since admin-metadata setup is a separate code path. The
          // accountManager reads from ["accounts","verified_metadata",oid].
          const existing = await kv.get<Record<string, unknown>>([
            "accounts",
            "verified_metadata",
            ownerOid,
          ]);
          assertExists(existing.value);
          await kv.set(["accounts", "verified_metadata", ownerOid], {
            ...existing.value,
            admin_verified_fields: {
              ...((existing.value as {
                admin_verified_fields?: Record<string, unknown>;
              })
                .admin_verified_fields ?? {}),
              institution: "Example University",
            },
          });

          await t.step(
            "immutable.domain_id always included; user/admin/custom merged",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const { result } = await callTool<{
                  invitation_id: string;
                }>(token, "send_invitation", {
                  receiver_domain: remoteDomain,
                  receptive_policy_id: crypto.randomUUID(),
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                  include_user_claims: ["name", "email", "nonexistent"],
                  include_admin_claims: ["institution", "missing"],
                  custom_claims: { note: "We met at the conference" },
                });
                assertExists(result);
                const calls = getCaptures();
                assertEquals(calls.length, 1);
                const env = calls[0].body as {
                  claims: {
                    immutable: { domain_id: string };
                    user?: Record<string, unknown>;
                    admin?: Record<string, unknown>;
                    custom?: Record<string, unknown>;
                  };
                };
                assertExists(env.claims.immutable.domain_id);
                assertEquals(env.claims.user?.name, "Alice Smith");
                assertEquals(env.claims.user?.email, "alice@sender.example");
                // Unknown user-key silently omitted.
                assertEquals("nonexistent" in (env.claims.user ?? {}), false);
                assertEquals(
                  env.claims.admin?.institution,
                  "Example University",
                );
                assertEquals("missing" in (env.claims.admin ?? {}), false);
                assertEquals(
                  env.claims.custom?.note,
                  "We met at the conference",
                );
              });
            },
          );

          await t.step(
            "no include_* and no custom_claims yields immutable only",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                await callTool(token, "send_invitation", {
                  receiver_domain: remoteDomain,
                  receptive_policy_id: crypto.randomUUID(),
                  communication_terms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                const env = getCaptures()[0].body as {
                  claims: Record<string, unknown>;
                };
                assertExists(env.claims.immutable);
                assertEquals("user" in env.claims, false);
                assertEquals("admin" in env.claims, false);
                assertEquals("custom" in env.claims, false);
              });
            },
          );

          await t.step(
            "custom_claims with nested object is rejected by schema",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const { result, body } = await callTool(
                  token,
                  "send_invitation",
                  {
                    receiver_domain: remoteDomain,
                    receptive_policy_id: crypto.randomUUID(),
                    communication_terms: {
                      categories: ["correspondence"],
                      max_content_rating: "PG",
                    },
                    custom_claims: { bad: { nested: "x" } },
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
