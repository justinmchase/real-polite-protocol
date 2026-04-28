import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

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

        await t.step(
          "deleted key is absent from historical list and active key is unchanged",
          async () => {
            // This step demonstrates that deleting a historical key makes it
            // permanently unavailable — a verifier looking for it would find nothing.
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            // Capture the current active key ID before rotation.
            const activeBefore = await callTool(token, "get_verification_key");
            assertEquals(activeBefore.status, 200);
            const activeBeforeText = (activeBefore.body.result as {
              content?: Array<{ text?: string }>;
            })
              .content?.[0]?.text;
            assertExists(activeBeforeText);
            const activeBeforeKey = JSON.parse(activeBeforeText) as Record<
              string,
              unknown
            >;

            // Rotate so activeBeforeKey moves to historical.
            const rotated = await callTool(token, "rotate_verification_key");
            assertEquals(rotated.status, 200);

            // Find the just-archived key in the historical list.
            const listedBefore = await callTool(token, "list_historical_keys");
            assertEquals(listedBefore.status, 200);
            const beforeText = (listedBefore.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(beforeText);
            const beforePayload = JSON.parse(beforeText) as {
              keys?: Array<Record<string, unknown>>;
            };
            const target = (beforePayload.keys ?? []).find(
              (k) => k.key_id === activeBeforeKey.key_id,
            );
            assertExists(target, "rotated key must appear in historical list");

            // Delete it.
            const deleted = await callTool(token, "delete_historical_key", {
              key_id: String(target.key_id),
            });
            assertEquals(deleted.status, 200);

            // The deleted key must be gone from the historical list.
            const listedAfter = await callTool(token, "list_historical_keys");
            assertEquals(listedAfter.status, 200);
            const afterText = (listedAfter.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(afterText);
            const afterPayload = JSON.parse(afterText) as {
              keys?: Array<Record<string, unknown>>;
            };
            const stillPresent = (afterPayload.keys ?? []).some(
              (k) => k.key_id === target.key_id,
            );
            assertEquals(
              stillPresent,
              false,
              "deleted key must not appear in historical list",
            );

            // Active key must still be present and different from the deleted one.
            const activeAfter = await callTool(token, "get_verification_key");
            assertEquals(activeAfter.status, 200);
            const activeAfterText = (activeAfter.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(activeAfterText);
            const activeAfterKey = JSON.parse(activeAfterText) as Record<
              string,
              unknown
            >;
            assertEquals(
              activeAfterKey.key_id !== target.key_id,
              true,
              "active key must be different from the deleted historical key",
            );
          },
        );

        await t.step(
          "attempting to delete the active verification key returns an error",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            // Get the current active key ID.
            const active = await callTool(token, "get_verification_key");
            assertEquals(active.status, 200);
            const activeText =
              (active.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(activeText);
            const activeKey = JSON.parse(activeText) as Record<string, unknown>;
            assertExists(activeKey.key_id);

            // Attempting to delete the active key must produce a tool-level error.
            const { status, body } = await callTool(
              token,
              "delete_historical_key",
              { key_id: String(activeKey.key_id) },
            );
            assertEquals(status, 200);
            const result = body.result as
              | { isError?: boolean }
              | undefined;
            assertEquals(
              result?.isError,
              true,
              "deleting the active key must return isError",
            );
          },
        );
      });
    });
  },
});
