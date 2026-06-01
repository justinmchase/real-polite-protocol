import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";
import { submitMessageEnvelope } from "../helpers/submit-message-envelope.ts";

Deno.test({
  name: "req:contacts-009 - unblock_contact tool",
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
            "unblock clears the blocked flag; inbound flows again",
            async () => {
              const c = await seedContact(kv, { ownerOid, blocked: true });
              const { status, result } = await callTool<{
                blocked: boolean;
                id: string;
              }>(token, "unblock_contact", { contact_id: c.id });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.blocked, false);
              assertEquals(result.id, c.id);

              const resp = await submitMessageEnvelope({
                credential: c.local_credential,
                senderDomain: c.remote_domain,
                baseUrl,
              });
              assertEquals(resp.status, 202);
              await resp.body?.cancel();
            },
          );

          await t.step("idempotent on already-unblocked contact", async () => {
            const c = await seedContact(kv, { ownerOid, blocked: false });
            const { result } = await callTool<{ blocked: boolean }>(
              token,
              "unblock_contact",
              { contact_id: c.id },
            );
            assertExists(result);
            assertEquals(result.blocked, false);
          });

          await t.step("unknown contact errors", async () => {
            const { result, body } = await callTool(token, "unblock_contact", {
              contact_id: crypto.randomUUID(),
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step("foreign contact errors", async () => {
            const c = await seedContact(kv, { ownerOid, blocked: true });
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result, body } = await callTool(
              otherToken,
              "unblock_contact",
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
