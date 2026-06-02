import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { seedContact } from "../helpers/seed-contact.ts";

interface ContactView {
  updated_at: string;
  fields: Record<
    string,
    Array<{ value: unknown; source: string; recorded_at: string }>
  >;
  current_fields: Record<
    string,
    { value: unknown; source: string; recorded_at: string }
  >;
}

Deno.test({
  name:
    "req:contacts-012 - Owner can remove a specific revision from a contact field's history",
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

          const t0 = new Date("2026-01-01T00:00:00.000Z");
          const t1 = new Date("2026-01-02T00:00:00.000Z");
          const t2 = new Date("2026-01-03T00:00:00.000Z");

          const contact = await seedContact(kv, {
            ownerOid,
            fields: {
              name: [
                { value: "Aliyah", source: "owner_note", recorded_at: t2 },
                { value: "Allie", source: "owner_note", recorded_at: t1 },
                { value: "Alice", source: "sender_verified", recorded_at: t0 },
              ],
              nickname: [
                { value: "Ali", source: "owner_note", recorded_at: t1 },
              ],
            },
          });

          await t.step(
            "removes a middle revision, preserving others and ordering",
            async () => {
              const before = await callTool<ContactView>(
                token,
                "get_contact",
                { contact_id: contact.id },
              );
              const { status, result } = await callTool<ContactView>(
                token,
                "remove_contact_field_revision",
                {
                  contact_id: contact.id,
                  key: "name",
                  recorded_at: t1.toISOString(),
                },
              );
              assertEquals(status, 200);
              assertExists(result);
              assertEquals(result.fields.name.length, 2);
              assertEquals(result.fields.name[0].value, "Aliyah");
              assertEquals(result.fields.name[1].value, "Alice");
              // current_fields still points at the newest surviving record.
              assertEquals(result.current_fields.name.value, "Aliyah");
              // updated_at advanced.
              assertEquals(
                new Date(result.updated_at).getTime() >
                  new Date(before.result!.updated_at).getTime(),
                true,
              );
            },
          );

          await t.step(
            "removing the most-recent revision exposes the next-newest in current_fields",
            async () => {
              const { result } = await callTool<ContactView>(
                token,
                "remove_contact_field_revision",
                {
                  contact_id: contact.id,
                  key: "name",
                  recorded_at: t2.toISOString(),
                },
              );
              assertExists(result);
              assertEquals(result.fields.name.length, 1);
              assertEquals(result.fields.name[0].value, "Alice");
              assertEquals(result.current_fields.name.value, "Alice");
            },
          );

          await t.step(
            "removing the only remaining revision drops the key from fields and current_fields",
            async () => {
              const { result } = await callTool<ContactView>(
                token,
                "remove_contact_field_revision",
                {
                  contact_id: contact.id,
                  key: "nickname",
                  recorded_at: t1.toISOString(),
                },
              );
              assertExists(result);
              assertEquals(result.fields.nickname, undefined);
              assertEquals(result.current_fields.nickname, undefined);
            },
          );

          await t.step(
            "non-matching recorded_at returns a structured error",
            async () => {
              const { result, body } = await callTool(
                token,
                "remove_contact_field_revision",
                {
                  contact_id: contact.id,
                  key: "name",
                  recorded_at: new Date("2030-01-01T00:00:00.000Z")
                    .toISOString(),
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "unknown contact returns a structured error",
            async () => {
              const { result, body } = await callTool(
                token,
                "remove_contact_field_revision",
                {
                  contact_id: crypto.randomUUID(),
                  key: "name",
                  recorded_at: t0.toISOString(),
                },
              );
              const errorish =
                (result as { ok?: boolean } | undefined)?.ok === false ||
                body.error !== undefined || result === undefined;
              assertEquals(errorish, true);
            },
          );

          await t.step(
            "foreign account cannot remove a revision",
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
                "remove_contact_field_revision",
                {
                  contact_id: contact.id,
                  key: "name",
                  recorded_at: t0.toISOString(),
                },
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
