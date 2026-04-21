import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:domain-admin-011 - Domain administrators can retrieve contact policy URL",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ kvPath }) => {
        await t.step(
          "domain admin can retrieve the current contact policy URL",
          async () => {
            const kv = await Deno.openKv(kvPath);
            try {
              await kv.set(["domain_identity"], {
                domain: "localhost",
                display_name: "Localhost",
                contact_policy_url: "https://example.test/contact-policy",
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
              "get_contact_policy_url",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { contact_policy_url?: string };
            assertEquals(
              payload.contact_policy_url,
              "https://example.test/contact-policy",
            );
          },
        );

        await t.step(
          "non-admin user cannot call get_contact_policy_url",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_contact_policy_url",
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
