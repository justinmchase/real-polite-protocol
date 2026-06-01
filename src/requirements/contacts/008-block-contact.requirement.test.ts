import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";
import { withRemoteServer } from "../helpers/with-remote-server.ts";

Deno.test({
  name: "req:contacts-008 - block_contact tool",
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
            "block sets blocked=true; credentials preserved",
            async () => {
              await withRemoteServer(async (remoteDomain) => {
                const c = await seedContact(kv, { ownerOid, remoteDomain });
                const { status, result } = await callTool<{
                  blocked: boolean;
                  id: string;
                }>(token, "block_contact", { contact_id: c.id });
                assertEquals(status, 200);
                assertExists(result);
                assertEquals(result.blocked, true);
                assertEquals(result.id, c.id);

                // Credentials still persisted on disk.
                const stored = await kv.get<Record<string, unknown>>([
                  "contacts",
                  ownerOid,
                  c.id,
                ]);
                assertExists(stored.value);
                assertExists(
                  (stored.value as { local_credential: unknown })
                    .local_credential,
                );
                assertExists(
                  (stored.value as { remote_credential: unknown })
                    .remote_credential,
                );
              });
            },
          );

          await t.step(
            "inbound envelope from blocked contact is rejected",
            async () => {
              const c = await seedContact(kv, { ownerOid, blocked: true });
              const resp = await submitMessageEnvelope({
                credential: c.local_credential,
                senderDomain: c.remote_domain,
                baseUrl,
              });
              assertEquals(resp.status >= 400, true);
              await resp.body?.cancel();
            },
          );

          await t.step(
            "send_message to a blocked contact refused locally (no outbound HTTP)",
            async () => {
              await withRemoteServer(async (remoteDomain, getCaptures) => {
                const c = await seedContact(kv, {
                  ownerOid,
                  remoteDomain,
                  blocked: true,
                });
                const { result, body } = await callTool(
                  token,
                  "send_message",
                  {
                    contact_id: c.id,
                    category: "correspondence",
                    content_rating: "G",
                    body: { content_type: "text/markdown", content: "hi" },
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

          await t.step("unknown contact errors", async () => {
            const { result, body } = await callTool(token, "block_contact", {
              contact_id: crypto.randomUUID(),
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step("foreign contact errors", async () => {
            const c = await seedContact(kv, { ownerOid });
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result, body } = await callTool(
              otherToken,
              "block_contact",
              { contact_id: c.id },
            );
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
