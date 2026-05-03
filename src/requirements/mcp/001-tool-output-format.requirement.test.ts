import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import {
  callToolsList,
  type ToolsListResult,
} from "../helpers/call-tools-list.ts";

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

        await t.step(
          "tools/list response includes outputSchema for every registered tool",
          async () => {
            const token = await issueToken({
              oid: crypto.randomUUID(),
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callToolsList(baseUrl, token);
            assertEquals(status, 200);
            const result = body.result as ToolsListResult | undefined;
            assertExists(result, "tools/list response missing result");

            for (const tool of result.tools) {
              assertExists(
                tool.outputSchema,
                `tool "${tool.name}" must declare an outputSchema`,
              );
            }
          },
        );

        await t.step(
          "tool registration uses registerTool — no deprecated .tool() calls in src/tools/",
          async () => {
            // Scan every .ts file under src/tools/ and assert there are no
            // calls to the deprecated .tool() method (only registerTool is allowed).
            const toolsDir = new URL("../../tools/", import.meta.url)
              .pathname;

            let deprecatedCount = 0;
            const violations: string[] = [];

            async function scanDir(dir: string): Promise<void> {
              for await (const entry of Deno.readDir(dir)) {
                const fullPath = `${dir}/${entry.name}`;
                if (entry.isDirectory) {
                  await scanDir(fullPath);
                } else if (entry.name.endsWith(".ts")) {
                  const source = await Deno.readTextFile(fullPath);
                  // Match server.tool( or .tool( patterns (not registerTool)
                  const matches = source.match(/\bserver\.tool\s*\(/g) ?? [];
                  if (matches.length > 0) {
                    deprecatedCount += matches.length;
                    violations.push(
                      `${entry.name}: ${matches.length} deprecated .tool() call(s)`,
                    );
                  }
                }
              }
            }

            await scanDir(toolsDir);
            assertEquals(
              deprecatedCount,
              0,
              `Deprecated server.tool() calls found:\n${violations.join("\n")}`,
            );
          },
        );

        await t.step(
          "tool result content array is never text-only without a structuredContent field",
          async () => {
            const token = await issueToken({
              oid: crypto.randomUUID(),
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const toolNames = [
              "get_permissions",
              "list_contacts",
              "get_domain_identity",
              "list_invitations",
              "list_messages",
              "get_receptive_policies",
            ];

            for (const toolName of toolNames) {
              const { status, body } = await callTool(token, toolName);
              assertEquals(status, 200, `${toolName} returned non-200 status`);
              assertExists(body.result, `${toolName} response missing result`);
              const result = body.result as {
                content?: Array<{ type?: string }>;
                structuredContent?: unknown;
              };

              // If content is present, structuredContent MUST also be present.
              if (result.content && result.content.length > 0) {
                assertExists(
                  result.structuredContent,
                  `${toolName}: content present but structuredContent is absent`,
                );
              }
            }
          },
        );
      });
    });
  },
});
