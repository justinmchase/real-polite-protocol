import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import { requiredScopes, withAuthTestContext } from "./auth/test-helpers.ts";

Deno.test({
  name: "req:mcp-001 - Tools use structured output with outputSchema",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool, baseUrl }) => {
        await t.step("server starts and becomes healthy", async () => {
          const res = await fetch(`${baseUrl}/health`);
          await res.body?.cancel();
          assertEquals(res.status, 200);
        });

        await t.step(
          "tool result contains structuredContent and text fallback",
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
              content?: Array<{ type?: string; text?: string }>;
              structuredContent?: Record<string, unknown>;
            };

            // Verify structuredContent is present and has expected fields
            assertExists(
              result.structuredContent,
              "Result must have structuredContent",
            );
            assertExists(
              result.structuredContent.domain,
              "structuredContent must have domain",
            );
            assertExists(
              result.structuredContent.display_name,
              "structuredContent must have display_name",
            );

            // Verify text fallback is also present
            assertExists(result.content, "Result must have content array");
            assertEquals(
              result.content.length > 0,
              true,
              "Content must not be empty",
            );

            const item = result.content[0];
            assertEquals(item.type, "text", "Content type must be 'text'");
            assertExists(item.text, "Content must have a text field");

            // Text fallback must be valid JSON matching structuredContent
            const parsed = JSON.parse(item.text);
            assertEquals(parsed.domain, result.structuredContent.domain);
            assertEquals(
              parsed.display_name,
              result.structuredContent.display_name,
            );
          },
        );
      });
    });
  },
});
