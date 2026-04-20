import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-007 - Domain administrators can list verifiable users",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        await t.step(
          "domain admin can list users with verified metadata fields",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set([
                "accounts",
                "verified_metadata",
                "oid-verifiable-1",
              ], {
                oid: "oid-verifiable-1",
                verified_fields: {
                  display_name: "Dr. Alice Smith",
                  description: "Computer Science Department",
                },
                updated_at: "2026-04-20T00:00:00.000Z",
              });
              await kv.set([
                "accounts",
                "verified_metadata",
                "oid-verifiable-2",
              ], {
                oid: "oid-verifiable-2",
                verified_fields: {
                  display_name: "Bob Jones",
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
              "list_verifiable_users",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);

            const payload = JSON.parse(text) as {
              users?: Array<{
                oid?: string;
                verified_fields?: Record<string, string>;
              }>;
            };
            const users = payload.users;
            assertExists(users);
            assertEquals(Array.isArray(users), true);

            const user1 = users.find((u) => u.oid === "oid-verifiable-1");
            const user2 = users.find((u) => u.oid === "oid-verifiable-2");
            assertExists(user1);
            assertExists(user2);
            assertEquals(
              user1.verified_fields?.display_name,
              "Dr. Alice Smith",
            );
            assertEquals(
              user1.verified_fields?.description,
              "Computer Science Department",
            );
            assertEquals(user2.verified_fields?.display_name, "Bob Jones");
          },
        );

        await t.step(
          "non-admin user cannot call list_verifiable_users",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "list_verifiable_users",
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
