import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-004 - Domain administrators can rotate the invitation verification key",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "domain admin can call rotate_verification_key",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "rotate_verification_key",
            );
            assertEquals(status, 200);
            assertExists(body.result);

            const result = body.result as {
              content?: Array<{ text?: string }>;
            };
            const text = result.content?.[0]?.text;
            assertExists(text);

            const key = JSON.parse(text) as Record<string, unknown>;
            assertExists(key.key_id);
            const publicKey = key.public_key as
              | Record<string, unknown>
              | undefined;
            assertExists(publicKey);
            assertEquals(publicKey.algorithm, "Ed25519");
            assertEquals(typeof publicKey.key, "string");
            assertEquals((publicKey.key as string).length > 0, true);
          },
        );

        await t.step(
          "rotation produces a different active key than before",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const before = await callTool(token, "get_verification_key");
            const beforeText =
              (before.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(beforeText);
            const beforeKey = JSON.parse(beforeText) as Record<string, unknown>;

            const rotated = await callTool(token, "rotate_verification_key");
            const rotatedText =
              (rotated.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(rotatedText);
            const rotatedKey = JSON.parse(rotatedText) as Record<
              string,
              unknown
            >;

            assertNotEquals(
              rotatedKey.key_id,
              beforeKey.key_id,
              "Rotated key_id should differ from previous active key",
            );
          },
        );

        await t.step(
          "get_verification_key returns the new key after rotation",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const rotated = await callTool(token, "rotate_verification_key");
            const rotatedText =
              (rotated.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(rotatedText);
            const rotatedKey = JSON.parse(rotatedText) as Record<
              string,
              unknown
            >;

            const active = await callTool(token, "get_verification_key");
            const activeText =
              (active.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(activeText);
            const activeKey = JSON.parse(activeText) as Record<string, unknown>;

            assertEquals(
              activeKey.key_id,
              rotatedKey.key_id,
              "get_verification_key should return the newly rotated key",
            );
          },
        );

        await t.step(
          "non-admin user cannot call rotate_verification_key",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "rotate_verification_key",
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
