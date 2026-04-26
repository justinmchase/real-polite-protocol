import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:domain-admin-001 - Domain administrators can retrieve domain identity",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool, baseUrl }) => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch(`${baseUrl}/health`);
          await res.body?.cancel();
          assertEquals(res.status, 200);
        });

        await t.step("domain admin can call get_domain_identity", async () => {
          const token = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const { status, body } = await callTool(token, "get_domain_identity");
          assertEquals(status, 200);
          assertExists(body.result);

          const result = body.result as { content?: Array<{ text?: string }> };
          const text = result.content?.[0]?.text;
          assertExists(text);

          const identity = JSON.parse(text) as Record<string, unknown>;
          assertExists(identity.domain);
          assertExists(identity.display_name);
        });

        await t.step(
          "non-admin user cannot call get_domain_identity",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_domain_identity",
            );
            assertEquals(status, 200);

            // MCP SDK returns a JSON-RPC error when the tool is not registered
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
