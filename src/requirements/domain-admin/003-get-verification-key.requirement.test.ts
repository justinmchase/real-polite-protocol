import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name:
    "req:domain-admin-003 - Domain administrators can retrieve the active verification key",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step("domain admin can call get_verification_key", async () => {
          const token = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const { status, body } = await callTool(
            token,
            "get_verification_key",
          );
          assertEquals(status, 200);
          assertExists(body.result);

          const result = body.result as { content?: Array<{ text?: string }> };
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
        });

        await t.step(
          "subsequent reads return the same active key",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            const first = await callTool(token, "get_verification_key");
            const second = await callTool(token, "get_verification_key");

            const firstText =
              (first.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            const secondText =
              (second.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(firstText);
            assertExists(secondText);

            const firstKey = JSON.parse(firstText) as Record<string, unknown>;
            const secondKey = JSON.parse(secondText) as Record<string, unknown>;
            assertEquals(secondKey.key_id, firstKey.key_id);
            assertEquals(secondKey.public_key, firstKey.public_key);
          },
        );

        await t.step(
          "non-admin user cannot call get_verification_key",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "get_verification_key",
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
