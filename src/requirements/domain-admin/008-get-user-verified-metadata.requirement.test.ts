import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-008 - Domain administrators can retrieve a user's verified metadata",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        await t.step(
          "domain admin can retrieve verified metadata for a target user",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set([
                "accounts",
                "verified_metadata",
                "oid-target-user",
              ], {
                oid: "oid-target-user",
                verified_fields: {
                  display_name: "Alice Example",
                  email: "alice@example.test",
                },
                updated_at: "2026-04-20T00:00:00.000Z",
              });
            } finally {
              kv.close();
            }

            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_user_verified_metadata",
              { oid: "oid-target-user" },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);

            const payload = JSON.parse(text) as {
              oid?: string;
              verified_fields?: Record<string, string>;
              updated_at?: string;
            };

            assertEquals(payload.oid, "oid-target-user");
            assertEquals(
              payload.verified_fields?.display_name,
              "Alice Example",
            );
            assertEquals(payload.verified_fields?.email, "alice@example.test");
            assertEquals(payload.updated_at, "2026-04-20T00:00:00.000Z");
          },
        );

        await t.step(
          "missing metadata returns a stable error contract",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_user_verified_metadata",
              { oid: "oid-missing-user" },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const result = body.result as {
              isError?: boolean;
              content?: Array<{ text?: string }>;
            };
            assertEquals(result.isError, true);

            const text = result.content?.[0]?.text;
            assertExists(text);

            const payload = JSON.parse(text) as {
              ok?: boolean;
              error?: { code?: string; message?: string };
            };

            assertEquals(payload.ok, false);
            assertEquals(
              payload.error?.code,
              "USER_VERIFIED_METADATA_NOT_FOUND",
            );
            assertEquals(
              payload.error?.message,
              "No verified metadata found for oid oid-missing-user",
            );
          },
        );

        await t.step(
          "non-admin user cannot call get_user_verified_metadata",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_user_verified_metadata",
              { oid: "oid-target-user" },
            );
            assertEquals(status, 200);

            const error = body.error as
              | { code?: number; message?: string }
              | undefined;
            const result = body.result as { isError?: boolean } | undefined;

            const isToolUnavailable = error !== undefined ||
              result?.isError === true;
            assertEquals(
              isToolUnavailable,
              true,
              `Tool should not be available to non-admin. Body: ${
                JSON.stringify(body)
              }`,
            );
          },
        );
      });
    });
  },
});
