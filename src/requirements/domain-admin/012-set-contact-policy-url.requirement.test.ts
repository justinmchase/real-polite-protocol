import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-012 - Domain administrators can set contact policy URL",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "domain admin can set contact policy URL and read it back",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_contact_policy_url",
              {
                contact_policy_url: "https://example.test/contact-policy",
              },
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

            const getResult = await callTool(token, "get_contact_policy_url");
            assertEquals(getResult.status, 200);
            const getText = (getResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(getText);
            const getPayload = JSON.parse(getText) as {
              contact_policy_url?: string;
            };
            assertEquals(
              getPayload.contact_policy_url,
              "https://example.test/contact-policy",
            );

            const identityResult = await callTool(token, "get_domain_identity");
            assertEquals(identityResult.status, 200);
            const identityText = (identityResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(identityText);
            const identityPayload = JSON.parse(identityText) as {
              contact_policy_url?: string;
            };
            assertEquals(
              identityPayload.contact_policy_url,
              "https://example.test/contact-policy",
            );
          },
        );

        await t.step(
          "invalid contact policy URL is rejected",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_contact_policy_url",
              {
                contact_policy_url: "not-a-url",
              },
            );
            assertEquals(status, 200);

            const hasError = body.error !== undefined ||
              (body.result as { isError?: boolean } | undefined)?.isError ===
                true;
            assertEquals(
              hasError,
              true,
              `Invalid URL should be rejected. Body: ${JSON.stringify(body)}`,
            );
          },
        );

        await t.step(
          "non-admin user cannot call set_contact_policy_url",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_contact_policy_url",
              {
                contact_policy_url: "https://example.test/contact-policy",
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
