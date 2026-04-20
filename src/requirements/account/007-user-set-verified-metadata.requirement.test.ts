import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:account-007 - Users can refresh their own verified metadata from their token",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step(
          "set_verified_metadata stores token identity claims for caller",
          async () => {
            const token = await issueToken({
              oid: "oid-token-metadata-user",
              scope: requiredScopes.join(" "),
              name: "Alice Example",
              email: "alice@example.test",
              preferred_username: "alice",
            });

            const { status, body } = await callTool(
              token,
              "set_verified_metadata",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text =
              (body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              oid?: string;
              verified_fields?: Record<string, string>;
              updated_at?: string;
            };

            assertEquals(record.oid, "oid-token-metadata-user");
            assertEquals(record.verified_fields?.name, "Alice Example");
            assertEquals(
              record.verified_fields?.email,
              "alice@example.test",
            );
            assertEquals(record.verified_fields?.preferred_username, "alice");
            assertExists(record.updated_at);
          },
        );

        await t.step(
          "token claims merge with existing fields without overwriting unrelated ones",
          async () => {
            // First call seeds with name + email
            const token1 = await issueToken({
              oid: "oid-merge-user",
              scope: requiredScopes.join(" "),
              name: "Bob Merge",
              email: "bob@example.test",
            });
            await callTool(token1, "set_verified_metadata");

            // Second call with updated name only — email should persist
            const token2 = await issueToken({
              oid: "oid-merge-user",
              scope: requiredScopes.join(" "),
              name: "Robert Merge",
            });
            const { status, body } = await callTool(
              token2,
              "set_verified_metadata",
            );
            assertEquals(status, 200);

            const text =
              (body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              verified_fields?: Record<string, string>;
            };
            assertEquals(record.verified_fields?.name, "Robert Merge");
            assertEquals(
              record.verified_fields?.email,
              "bob@example.test",
            );
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
              "set_verified_metadata",
              { name: "Injected Name", arbitrary_field: "hacked" },
            );
            assertEquals(status, 200);

            const text =
              (body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(text);

            const record = JSON.parse(text) as {
              verified_fields?: Record<string, string>;
            };
            assertEquals(record.verified_fields?.name, "Carol Real");
            assertEquals(record.verified_fields?.arbitrary_field, undefined);
          },
        );
      });
    });
  },
});
