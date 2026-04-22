import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";

Deno.test({
  name:
    "req:domain-admin-005 - Domain administrators can list archived verification keys",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ callTool }) => {
        await t.step(
          "domain admin can list archived keys with metadata",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

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

            const rotated = await callTool(token, "rotate_verification_key");
            assertEquals(rotated.status, 200);

            const listed = await callTool(token, "list_historical_keys");
            assertEquals(listed.status, 200);
            assertExists(listed.body.result);

            const listedText =
              (listed.body.result as { content?: Array<{ text?: string }> })
                .content?.[0]?.text;
            assertExists(listedText);

            const payload = JSON.parse(listedText) as {
              keys?: Array<Record<string, unknown>>;
            };
            const keys = payload.keys;
            assertExists(keys);
            assertEquals(Array.isArray(keys), true);
            assertEquals(keys.length > 0, true);

            const archivedFirst = keys.find((k) =>
              k.key_id === activeBeforeKey.key_id
            );
            assertExists(
              archivedFirst,
              "Expected previously active key to appear in historical keys",
            );
            assertExists(archivedFirst.archived_at);

            const publicKey = archivedFirst.public_key as
              | Record<string, unknown>
              | undefined;
            assertExists(publicKey);
            assertEquals(publicKey.algorithm, "Ed25519");
            assertEquals(typeof publicKey.key, "string");
            assertEquals((publicKey.key as string).length > 0, true);
          },
        );

        await t.step(
          "list_historical_keys supports resume-token pagination",
          async () => {
            const token = await issueToken({
              oid: "oid-domain-admin-pagination",
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
            });

            // Ensure multiple historical records exist.
            await callTool(token, "get_verification_key");
            await callTool(token, "rotate_verification_key");
            await callTool(token, "rotate_verification_key");

            const firstPage = await callTool(token, "list_historical_keys", {
              page_size: 1,
            });
            assertEquals(firstPage.status, 200);
            const firstText = (firstPage.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(firstText);
            const firstPayload = JSON.parse(firstText) as {
              keys?: Array<{ key_id?: string }>;
              next_resume_token?: string;
            };
            assertExists(firstPayload.keys);
            assertEquals(firstPayload.keys.length, 1);
            assertExists(firstPayload.next_resume_token);

            const secondPage = await callTool(token, "list_historical_keys", {
              page_size: 1,
              resume_token: firstPayload.next_resume_token,
            });
            assertEquals(secondPage.status, 200);
            const secondText = (secondPage.body.result as {
              content?: Array<{ text?: string }>;
            }).content?.[0]?.text;
            assertExists(secondText);
            const secondPayload = JSON.parse(secondText) as {
              keys?: Array<{ key_id?: string }>;
            };
            assertExists(secondPayload.keys);
            assertEquals(secondPayload.keys.length, 1);

            const firstKeyId = firstPayload.keys[0]?.key_id;
            const secondKeyId = secondPayload.keys[0]?.key_id;
            assertExists(firstKeyId);
            assertExists(secondKeyId);
            assertEquals(firstKeyId === secondKeyId, false);
          },
        );

        await t.step(
          "non-admin user cannot call list_historical_keys",
          async () => {
            const token = await issueToken({
              oid: "oid-listener",
              roles: [],
              scope: requiredScopes.join(" "),
            });

            const { status, body } = await callTool(
              token,
              "list_historical_keys",
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
