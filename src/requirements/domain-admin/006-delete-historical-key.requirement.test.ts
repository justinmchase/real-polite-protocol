import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-006 - Domain administrators can delete archived verification keys",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step("domain admin can delete a historical key", async () => {
          const token = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const active = await callTool(token, "get_verification_key");
          assertEquals(active.status, 200);
          const activeText =
            (active.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
          assertExists(activeText);
          const activeKey = JSON.parse(activeText) as Record<string, unknown>;

          const rotated = await callTool(token, "rotate_verification_key");
          assertEquals(rotated.status, 200);

          const listedBefore = await callTool(token, "list_historical_keys");
          assertEquals(listedBefore.status, 200);
          const listedBeforeText = (listedBefore.body.result as {
            content?: Array<{ text?: string }>;
          }).content?.[0]?.text;
          assertExists(listedBeforeText);
          const beforePayload = JSON.parse(listedBeforeText) as {
            keys?: Array<Record<string, unknown>>;
          };
          const beforeKeys = beforePayload.keys ?? [];
          const target = beforeKeys.find((k) => k.key_id === activeKey.key_id);
          assertExists(target);

          const deleted = await callTool(token, "delete_historical_key", {
            key_id: String(target.key_id),
          });
          assertEquals(deleted.status, 200);
          const deletedText =
            (deleted.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
          assertExists(deletedText);
          const deletedPayload = JSON.parse(deletedText) as Record<
            string,
            unknown
          >;
          assertEquals(deletedPayload.key_id, target.key_id);
          assertEquals(deletedPayload.deleted, true);

          const listedAfter = await callTool(token, "list_historical_keys");
          assertEquals(listedAfter.status, 200);
          const listedAfterText =
            (listedAfter.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
          assertExists(listedAfterText);
          const afterPayload = JSON.parse(listedAfterText) as {
            keys?: Array<Record<string, unknown>>;
          };
          const afterKeys = afterPayload.keys ?? [];
          const stillPresent = afterKeys.some((k) =>
            k.key_id === target.key_id
          );
          assertEquals(stillPresent, false);
        });

        await t.step(
          "non-admin user cannot call delete_historical_key",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "delete_historical_key",
              {
                key_id: "key-does-not-matter",
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
