import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-007 - Domain administrators can list verifiable users",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath, callTool }) => {
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
                user_verified_fields: {
                  display_name: "Alice Token",
                  description: "Computer Science Department",
                },
                admin_verified_fields: {
                  display_name: "Dr. Alice Smith",
                },
                user_updated_at: "2026-04-20T00:00:00.000Z",
                admin_updated_at: "2026-04-20T00:00:00.000Z",
                updated_at: "2026-04-20T00:00:00.000Z",
              });
              await kv.set([
                "accounts",
                "verified_metadata",
                "oid-verifiable-2",
              ], {
                oid: "oid-verifiable-2",
                user_verified_fields: {
                  display_name: "Bob Jones",
                },
                admin_verified_fields: {},
                user_updated_at: "2026-04-20T00:00:00.000Z",
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
          "list_verifiable_users supports resume-token pagination",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set([
                "accounts",
                "verified_metadata",
                "oid-verifiable-3",
              ], {
                oid: "oid-verifiable-3",
                user_verified_fields: {
                  display_name: "Carol White",
                },
                admin_verified_fields: {},
                user_updated_at: "2026-04-20T00:00:00.000Z",
                updated_at: "2026-04-20T00:00:00.000Z",
              });
            } finally {
              kv.close();
            }

            const token = await issueToken({
              oid: "oid-domain-admin-pagination",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const firstPage = await callTool(token, "list_verifiable_users", {
              page_size: 1,
            });
            assertEquals(firstPage.status, 200);
            const firstText = (firstPage.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(firstText);
            const firstPayload = JSON.parse(firstText) as {
              users?: Array<{ oid?: string }>;
              next_resume_token?: string;
            };
            assertExists(firstPayload.users);
            assertEquals(firstPayload.users.length, 1);
            assertExists(firstPayload.next_resume_token);

            const secondPage = await callTool(token, "list_verifiable_users", {
              page_size: 1,
              resume_token: firstPayload.next_resume_token,
            });
            assertEquals(secondPage.status, 200);
            const secondText = (secondPage.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(secondText);
            const secondPayload = JSON.parse(secondText) as {
              users?: Array<{ oid?: string }>;
            };
            assertExists(secondPayload.users);
            assertEquals(secondPayload.users.length, 1);

            const firstOid = firstPayload.users[0]?.oid;
            const secondOid = secondPayload.users[0]?.oid;
            assertExists(firstOid);
            assertExists(secondOid);
            assertEquals(firstOid === secondOid, false);
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
