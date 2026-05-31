import { assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name:
    "req:contacts-011 - Soft term enforcement on inbound and outbound messages",
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
            "outbound: send_message blocks unpermitted category (no HTTP made)",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                  remoteTerms: {
                    categories: ["correspondence"],
                    max_content_rating: "PG",
                  },
                });
                const { result, body } = await callTool(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "marketing",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "x" },
                  },
                );
                const errorish =
                  (result as { ok?: boolean } | undefined)?.ok === false ||
                  body.error !== undefined || result === undefined;
                assertEquals(errorish, true);
                assertEquals(getCaptures().length, 0);
              });
            },
          );

          await t.step(
            "outbound: send_message blocks rating that exceeds max_content_rating",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                  remoteTerms: {
                    categories: ["correspondence"],
                    max_content_rating: "G",
                  },
                });
                const { result, body } = await callTool(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "R",
                    body: { content_type: "text/markdown", content: "x" },
                  },
                );
                const errorish =
                  (result as { ok?: boolean } | undefined)?.ok === false ||
                  body.error !== undefined || result === undefined;
                assertEquals(errorish, true);
                assertEquals(getCaptures().length, 0);
              });
            },
          );

          await t.step(
            "inbound envelope with category outside local_terms -> 403 E_CATEGORY_NOT_PERMITTED",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                localTerms: {
                  categories: ["correspondence"],
                  max_content_rating: "PG",
                },
              });
              const resp = await submitMessageEnvelope({
                credential: c.local_credential,
                senderDomain: c.remote_domain,
                category: "marketing",
                baseUrl,
              });
              assertEquals(resp.status, 403);
              assertEquals(
                ((await resp.json()) as { code: string }).code,
                "E_CATEGORY_NOT_PERMITTED",
              );
            },
          );

          await t.step(
            "inbound envelope rating exceeding local_terms -> 403 E_CONTENT_RATING_NOT_PERMITTED",
            async () => {
              const c = await seedContact(kv, {
                ownerOid,
                localTerms: {
                  categories: ["correspondence"],
                  max_content_rating: "G",
                },
              });
              const resp = await submitMessageEnvelope({
                credential: c.local_credential,
                senderDomain: c.remote_domain,
                contentRating: "R",
                baseUrl,
              });
              assertEquals(resp.status, 403);
              assertEquals(
                ((await resp.json()) as { code: string }).code,
                "E_CONTENT_RATING_NOT_PERMITTED",
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
