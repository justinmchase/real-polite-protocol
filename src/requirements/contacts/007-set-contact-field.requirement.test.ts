import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";

Deno.test({
  name: "req:contacts-007 - Owner-authored custom field on a contact",
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
            "prepends an owner_note record; updates updated_at",
            async () => {
              const before = await callTool<{ updated_at: string }>(
                token,
                "get_contact",
                { contact_id: contact.id },
              );
              const { status, result } = await callTool<{
                fields: Record<
                  string,
                  Array<{ value: unknown; source: string }>
                >;
                updated_at: string;
              }>(token, "set_contact_field", {
                contact_id: contact.id,
                key: "name",
                value: "Aliyah",
              });
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.fields.name.length, 2);
              assertEquals(result.fields.name[0].value, "Aliyah");
              assertEquals(result.fields.name[0].source, "owner_note");
              assertEquals(result.fields.name[1].value, "Alice");
              assertEquals(
                new Date(result.updated_at).getTime() >=
                  new Date(before.result!.updated_at).getTime(),
                true,
              );
            },
          );

          await t.step(
            "accepts string|number|boolean|null|array values",
            async () => {
              for (
                const v of [
                  42,
                  true,
                  null,
                  ["a", 1, false, null],
                ] as unknown[]
              ) {
                const { result } = await callTool<{
                  fields: Record<string, Array<{ value: unknown }>>;
                }>(token, "set_contact_field", {
                  contact_id: contact.id,
                  key: "polytype",
                  value: v,
                });
                assertExists(result);
                assertEquals(result.fields.polytype[0].value, v);
              }
            },
          );

          await t.step("unknown contact errors", async () => {
            const { result, body } = await callTool(
              token,
              "set_contact_field",
              {
                contact_id: crypto.randomUUID(),
                key: "x",
                value: "y",
              },
            );
            const errorish =
              (result as { ok?: boolean } | undefined)?.ok === false ||
              body.error !== undefined || result === undefined;
            assertEquals(errorish, true);
          });

          await t.step("foreign account cannot set field", async () => {
            const otherOid = crypto.randomUUID();
            const otherToken = await issueToken({
              oid: otherOid,
              scope: requiredScopes.join(" "),
              name: "Other",
            });
            await callTool(otherToken, "set_user_verified_metadata");
            const { result, body } = await callTool(
              otherToken,
              "set_contact_field",
              { contact_id: contact.id, key: "x", value: "y" },
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
