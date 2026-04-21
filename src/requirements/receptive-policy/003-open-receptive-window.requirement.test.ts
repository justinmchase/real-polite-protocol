import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name: "req:receptive-policy-003 - Listeners can open a time-bounded receptive window",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        await t.step(
          "opening a window sets receptive_until and returns the policy",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-001",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const before = new Date();
            const { status, body } = await callTool(
              token,
              "open_receptive_window",
              { duration_seconds: 60 },
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              receptive_until?: string;
              window_scope?: string;
            };
            assertExists(payload.receptive_until);
            assertEquals(payload.window_scope, "all");

            const receptiveUntil = new Date(payload.receptive_until!);
            assertEquals(
              receptiveUntil > before,
              true,
              "receptive_until should be in the future",
            );
            assertEquals(
              receptiveUntil.getTime() - before.getTime() > 55_000,
              true,
              "receptive_until should be approximately 60 seconds from now",
            );
          },
        );

        await t.step(
          "window scope defaults to all when not specified",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-002",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "open_receptive_window",
              { duration_seconds: 30 },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { window_scope?: string };
            assertEquals(payload.window_scope, "all");
          },
        );

        await t.step(
          "window with domain_filter scope stores the window filter rules",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-003",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "open_receptive_window",
              {
                duration_seconds: 60,
                scope: "domain_filter",
                window_domain_filter: {
                  rules: [{ action: "allow", pattern: "**.edu" }],
                },
              },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as {
              window_scope?: string;
              window_domain_filter?: { rules?: unknown[] };
            };
            assertEquals(payload.window_scope, "domain_filter");
            assertExists(payload.window_domain_filter);
            assertEquals(payload.window_domain_filter.rules?.length, 1);
          },
        );

        await t.step(
          "opening a new window replaces the previous window",
          async () => {
            const token = await issueToken({
              oid: "oid-listener-win-004",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            await callTool(token, "open_receptive_window", {
              duration_seconds: 3600,
            });

            const { status, body } = await callTool(
              token,
              "open_receptive_window",
              { duration_seconds: 120 },
            );
            assertEquals(status, 200);

            const text = (body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            const payload = JSON.parse(text) as { receptive_until?: string };
            assertExists(payload.receptive_until);

            const receptiveUntil = new Date(payload.receptive_until!);
            const now = new Date();
            assertEquals(
              receptiveUntil.getTime() - now.getTime() < 180_000,
              true,
              "Second window should replace the first (receptive_until ~120s, not 3600s)",
            );
          },
        );
      });
    });
  },
});
