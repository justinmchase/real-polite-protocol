import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

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
        await t.step(
          "structuredContent is present across tools from different modules",
          async () => {
            // Verify that the toolResult() helper pattern is consistently
            // applied across modules by calling one representative tool from
            // each of several different tool modules and asserting that every
            // response includes structuredContent.
            const token = await issueToken({
              oid: crypto.randomUUID(),
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const toolNames = [
              "get_permissions", // account module
              "list_contacts", // contacts module
              "get_domain_identity", // domain-admin module
            ];

            for (const toolName of toolNames) {
              const { status, body } = await callTool(token, toolName);
              assertEquals(status, 200, `${toolName} returned non-200 status`);
              assertExists(body.result, `${toolName} response missing result`);
              const result = body.result as {
                structuredContent?: Record<string, unknown>;
              };
              assertExists(
                result.structuredContent,
                `${toolName} result missing structuredContent — toolResult() helper must be used`,
              );
            }
          },
        );
      });
    });
  },
});
