import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receptive-policy-002 - Listeners can update their receptive policy",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step(
          "authenticated user can set mode to all and read it back",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_receptive_policy",
              { mode: "all" },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { mode?: string };
            assertEquals(payload.mode, "all");

            const getResult = await callTool(token, "get_receptive_policy");
            assertEquals(getResult.status, 200);
            const getText = (getResult.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(getText);
            const getPayload = JSON.parse(getText) as { mode?: string };
            assertEquals(getPayload.mode, "all");
          },
        );

        await t.step(
          "authenticated user can set mode to closed",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_receptive_policy",
              { mode: "closed" },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { mode?: string };
            assertEquals(payload.mode, "closed");
          },
        );

        await t.step(
          "authenticated user can set domain_filter mode with rules",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-set-003",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "set_receptive_policy",
              {
                mode: "domain_filter",
                domain_filter: {
                  rules: [
                    { action: "allow", pattern: "**.edu" },
                    { action: "block", pattern: "*" },
                  ],
                },
              },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              mode?: string;
              domain_filter?: { rules?: Array<{ action: string; pattern: string }> };
            };
            assertEquals(payload.mode, "domain_filter");
            assertExists(payload.domain_filter);
            assertEquals(payload.domain_filter.rules?.length, 2);
          },
        );
      });
    });
  },
});
