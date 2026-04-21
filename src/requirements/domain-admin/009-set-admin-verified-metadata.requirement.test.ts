import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-009 - Domain administrators can set admin verified metadata",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        await t.step(
          "domain admin can set arbitrary admin metadata for a registered user",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set(["accounts", "by_oid", "oid-target-user"], {
                id: "account-target-user",
                oid: "oid-target-user",
                created_at: "2026-04-20T00:00:00.000Z",
                updated_at: "2026-04-20T00:00:00.000Z",
              });
              await kv.set(["accounts", "verified_metadata", "oid-target-user"], {
                oid: "oid-target-user",
                user_verified_fields: {
                  display_name: "Alice Token",
                  email: "alice@example.test",
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
              "set_admin_verified_metadata",
              {
                oid: "oid-target-user",
                verified_fields: {
                  display_name: "Dr. Alice Smith",
                  title: "Professor",
                  office: "CS-402",
                },
              },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              oid?: string;
              user_verified_fields?: Record<string, string>;
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
              admin_updated_at?: string;
              updated_at?: string;
            };

            assertEquals(payload.oid, "oid-target-user");
            assertEquals(
              payload.user_verified_fields?.display_name,
              "Alice Token",
            );
            assertEquals(
              payload.user_verified_fields?.email,
              "alice@example.test",
            );
            assertEquals(
              payload.admin_verified_fields?.display_name,
              "Dr. Alice Smith",
            );
            assertEquals(payload.admin_verified_fields?.title, "Professor");
            assertEquals(payload.admin_verified_fields?.office, "CS-402");
            assertEquals(payload.verified_fields?.display_name, "Dr. Alice Smith");
            assertEquals(payload.verified_fields?.title, "Professor");
            assertEquals(payload.verified_fields?.office, "CS-402");
            assertEquals(payload.verified_fields?.email, "alice@example.test");
            assertExists(payload.admin_updated_at);
            assertExists(payload.updated_at);

            const getResult = await callTool(
              token,
              "get_user_verified_metadata",
              { oid: "oid-target-user" },
            );
            assertEquals(getResult.status, 200);
            const getText = (getResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(getText);
            const getPayload = JSON.parse(getText) as {
              user_verified_fields?: Record<string, string>;
              admin_verified_fields?: Record<string, string>;
              verified_fields?: Record<string, string>;
            };
            assertEquals(
              getPayload.user_verified_fields?.display_name,
              "Alice Token",
            );
            assertEquals(
              getPayload.admin_verified_fields?.display_name,
              "Dr. Alice Smith",
            );
            assertEquals(getPayload.verified_fields?.display_name, "Dr. Alice Smith");

            const listResult = await callTool(token, "list_verifiable_users");
            assertEquals(listResult.status, 200);
            const listText = (listResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(listText);
            const listPayload = JSON.parse(listText) as {
              users?: Array<{
                oid?: string;
                verified_fields?: Record<string, string>;
              }>;
            };
            const user = listPayload.users?.find((u) => u.oid === "oid-target-user");
            assertExists(user);
            assertEquals(user.verified_fields?.title, "Professor");
            assertEquals(user.verified_fields?.display_name, "Dr. Alice Smith");
            assertEquals(user.verified_fields?.email, "alice@example.test");
          },
        );

        await t.step(
          "admin metadata values longer than 512 characters are rejected",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_admin_verified_metadata",
              {
                oid: "oid-target-user",
                verified_fields: { note: "x".repeat(513) },
              },
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
            assertEquals(payload.error?.code, "E_VERIFIED_METADATA_VALUE_TOO_LONG");
            assertEquals(
              payload.error?.message,
              "Verified metadata value for field note exceeds maximum length 512",
            );
          },
        );

        await t.step(
          "missing account returns a stable error contract",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_admin_verified_metadata",
              {
                oid: "oid-missing-user",
                verified_fields: { display_name: "Ghost" },
              },
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
            assertEquals(payload.error?.code, "E_ACCOUNT_NOT_FOUND");
            assertEquals(
              payload.error?.message,
              "No registered account found for oid oid-missing-user",
            );
          },
        );

        await t.step(
          "non-admin user cannot call set_admin_verified_metadata",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_admin_verified_metadata",
              {
                oid: "oid-target-user",
                verified_fields: { display_name: "Injected" },
              },
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