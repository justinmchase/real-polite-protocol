import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-002 - Domain administrators can update domain identity fields",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool, baseUrl }) => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch(`${baseUrl}/health`);
          await res.body?.cancel();
          assertEquals(res.status, 200);
        });

        await t.step("domain admin can update identity fields", async () => {
          const token = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const { status, body } = await callTool(
            token,
            "update_domain_identity",
            { display_name: "My Cool Domain", domain_type: "podcast" },
          );
          assertEquals(status, 200);
          assertExists(body.result);

          const result = body.result as {
            content?: Array<{ text?: string }>;
          };
          const text = result.content?.[0]?.text;
          assertExists(text);

          const identity = JSON.parse(text) as Record<string, unknown>;
          assertEquals(identity.display_name, "My Cool Domain");
          assertEquals(identity.domain_type, "podcast");
        });

        await t.step(
          "updated identity is reflected in subsequent reads",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_domain_identity",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const result = body.result as {
              content?: Array<{ text?: string }>;
            };
            const text = result.content?.[0]?.text;
            assertExists(text);

            const identity = JSON.parse(text) as Record<string, unknown>;
            assertEquals(identity.display_name, "My Cool Domain");
            assertEquals(identity.domain_type, "podcast");
          },
        );

        await t.step(
          "domain field cannot be changed via update",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            // The domain field is not an accepted parameter, so it stays unchanged
            const { status, body } = await callTool(
              token,
              "update_domain_identity",
              { display_name: "Updated Again" },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const result = body.result as {
              content?: Array<{ text?: string }>;
            };
            const text = result.content?.[0]?.text;
            assertExists(text);

            const identity = JSON.parse(text) as Record<string, unknown>;
            assertExists(identity.domain);
            assertEquals(identity.display_name, "Updated Again");
          },
        );

        await t.step(
          "non-admin user cannot call update_domain_identity",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "update_domain_identity",
              { display_name: "Hacked" },
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
