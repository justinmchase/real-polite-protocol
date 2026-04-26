import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:account-007 - Users can refresh their own verified metadata from their token",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "set_user_verified_metadata stores token identity claims for caller",
          async () => {
            const token = await issueToken({
              oid: "oid-token-metadata-user",
              scope: requiredScopes.join(" "),
              name: "Alice Example",
              email: "alice@example.test",
              preferred_username: "alice",
              ctry: "US",
            });

            const { status, body } = await callTool(
              token,
              "set_user_verified_metadata",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              oid?: string;
              user_verified_fields?: Record<string, string>;
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
              user_updated_at?: string;
              updated_at?: string;
            };

            assertEquals(record.oid, "oid-token-metadata-user");
            assertEquals(
              record.user_verified_fields?.name,
              "Alice Example",
            );
            assertEquals(record.verified_fields?.name, "Alice Example");
            assertEquals(
              record.verified_fields?.email,
              "alice@example.test",
            );
            assertEquals(record.verified_fields?.preferred_username, "alice");
            assertEquals(record.verified_fields?.ctry, "US");
            assertEquals(record.admin_verified_fields, {});
            assertExists(record.user_updated_at);
            assertExists(record.updated_at);
          },
        );

        await t.step(
          "user refresh replaces prior user metadata and preserves admin overrides",
          async () => {
            const token1 = await issueToken({
              oid: "oid-merge-user",
              scope: requiredScopes.join(" "),
              name: "Bob Merge",
              email: "bob@example.test",
            });
            await callTool(token1, "set_user_verified_metadata");

            const adminToken = await issueToken({
              oid: "oid-merge-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });
            await callTool(adminToken, "set_admin_verified_metadata", {
              oid: "oid-merge-user",
              verified_fields: {
                name: "Admin Override",
                title: "Professor",
              },
            });

            const token2 = await issueToken({
              oid: "oid-merge-user",
              scope: requiredScopes.join(" "),
              name: "Robert Merge",
            });
            const { status, body } = await callTool(
              token2,
              "set_user_verified_metadata",
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              user_verified_fields?: Record<string, string>;
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
            };
            assertEquals(record.user_verified_fields?.name, "Robert Merge");
            assertEquals(record.user_verified_fields?.email, undefined);
            assertEquals(record.admin_verified_fields?.name, "Admin Override");
            assertEquals(record.admin_verified_fields?.title, "Professor");
            assertEquals(record.verified_fields?.name, "Admin Override");
            assertEquals(record.verified_fields?.title, "Professor");
            assertEquals(record.verified_fields?.email, undefined);
          },
        );

        await t.step(
          "does not accept caller-supplied field values in arguments",
          async () => {
            const token = await issueToken({
              oid: "oid-no-inject-user",
              scope: requiredScopes.join(" "),
              name: "Carol Real",
            });

            // Passing injected args — should be ignored, result reflects token only
            const { status, body } = await callTool(
              token,
              "set_user_verified_metadata",
              { name: "Injected Name", arbitrary_field: "hacked" },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              user_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
            };
            assertEquals(record.user_verified_fields?.name, "Carol Real");
            assertEquals(record.verified_fields?.name, "Carol Real");
            assertEquals(record.verified_fields?.arbitrary_field, undefined);
          },
        );
      });
    });
  },
});
