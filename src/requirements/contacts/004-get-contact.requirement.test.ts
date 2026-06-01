import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";

Deno.test({
  name: "req:contacts-004 - get_contact tool",
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

          const contact = await seedContact(kv, {
            ownerOid,
            fields: {
              name: [{
                value: "Alice",
                source: "sender_verified",
                recorded_at: new Date(),
              }],
            },
          });

          await t.step(
            "returns the contact with fields, current_fields, terms, blocked, timestamps; no secrets",
            async () => {
              const { status, result } = await callTool<{
                id: string;
                remote_domain: string;
                remote_domain_id: string;
                fields: Record<string, unknown[]>;
                current_fields: Record<string, unknown>;
                local_terms: unknown;
                remote_terms: unknown;
                blocked: boolean;
                created_at: string;
                updated_at: string;
                local_credential?: { contact_secret?: unknown };
                remote_credential?: { contact_secret?: unknown };
              }>(token, "get_contact", { contact_id: contact.id });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.id, contact.id);
              assertExists(result.fields.name);
              assertExists(result.current_fields.name);
              assertExists(result.local_terms);
              assertExists(result.remote_terms);
              assertEquals(result.blocked, false);
              assertEquals(
                result.local_credential?.contact_secret === undefined,
                true,
              );
              assertEquals(
                result.remote_credential?.contact_secret === undefined,
                true,
              );
            },
          );

          await t.step("unknown contact_id errors", async () => {
            const { result, body } = await callTool(token, "get_contact", {
              contact_id: crypto.randomUUID(),
            });
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step(
            "contact owned by another account is hidden",
            async () => {
              const otherOid = crypto.randomUUID();
              const otherToken = await issueToken({
                oid: otherOid,
                scope: requiredScopes.join(" "),
                name: "Other",
              });
              await callTool(otherToken, "set_user_verified_metadata");
              const { result, body } = await callTool(
                otherToken,
                "get_contact",
                { contact_id: contact.id },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );
        } finally {
          kv.close();
        }
      });
    });
  },
});
