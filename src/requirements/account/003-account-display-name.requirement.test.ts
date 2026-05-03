import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { callGetPermissions } from "../helpers/call-get-permissions.ts";
import { callTool } from "../helpers/call-tool.ts";

interface AccountRecord {
  id: string;
  oid: string;
  display_name?: string;
}

Deno.test("req:account-003 - Account display_name is optional and not required for MCP operations", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      await t.step(
        "authenticated request succeeds without any display name",
        async () => {
          const token = await issueToken({
            oid: "account-display-name-oid",
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);

          assertEquals(permissions.oid, "account-display-name-oid");
          assertExists(permissions.account_id);
        },
      );

      await t.step("new account defaults to no display_name", async () => {
        const kv = await Deno.openKv(kvPath);
        try {
          const entry = await kv.get<AccountRecord>([
            "accounts",
            "by_oid",
            "account-display-name-oid",
          ]);
          assertExists(entry.value);
          assertEquals(entry.value.display_name, undefined);
        } finally {
          kv.close();
        }
      });

      await t.step(
        "set_display_name stores a display name and get_display_name returns it; passing null clears it",
        async () => {
          const token = await issueToken({
            oid: "account-display-name-set-oid",
            scope: requiredScopes.join(" "),
          });

          // Ensure account exists first.
          await callGetPermissions(token, {}, baseUrl);

          // Set a display name.
          const { status: s1, result: r1 } = await callTool<
            { display_name: string | null }
          >(token, "set_display_name", { display_name: "Test User" }, baseUrl);
          assertEquals(s1, 200);
          assertEquals(r1?.display_name, "Test User");

          // Verify via get_display_name.
          const { status: s2, result: r2 } = await callTool<
            { display_name: string | null }
          >(token, "get_display_name", {}, baseUrl);
          assertEquals(s2, 200);
          assertEquals(r2?.display_name, "Test User");

          // Clear by passing null.
          const { status: s3, result: r3 } = await callTool<
            { display_name: string | null }
          >(token, "set_display_name", { display_name: null }, baseUrl);
          assertEquals(s3, 200);
          assertEquals(r3?.display_name, null);

          // Verify cleared.
          const { result: r4 } = await callTool<
            { display_name: string | null }
          >(
            token,
            "get_display_name",
            {},
            baseUrl,
          );
          assertEquals(r4?.display_name, null);
        },
      );

      await t.step(
        "set_display_name accepts a 256-code-point string and rejects a 257-code-point string",
        async () => {
          const token = await issueToken({
            oid: "account-display-name-limit-oid",
            scope: requiredScopes.join(" "),
          });

          // Ensure account exists.
          await callGetPermissions(token, {}, baseUrl);

          const name256 = "A".repeat(256);
          const name257 = "A".repeat(257);

          // 256 chars must succeed.
          const { status: sOk } = await callTool(
            token,
            "set_display_name",
            { display_name: name256 },
            baseUrl,
          );
          assertEquals(sOk, 200, "256-char display name must be accepted");

          // 257 chars must fail with a validation / tool error.
          const { body: errBody } = await callTool(
            token,
            "set_display_name",
            { display_name: name257 },
            baseUrl,
          );
          const errBodyUnknown = errBody as unknown as {
            isError?: boolean;
            result?: { isError?: boolean };
          };
          assertEquals(
            errBodyUnknown.isError ?? errBodyUnknown.result?.isError,
            true,
            "257-char display name must be rejected as a tool-level error",
          );
        },
      );

      await t.step(
        "get_display_name returns the display name stored for the calling account",
        async () => {
          const token = await issueToken({
            oid: "account-display-name-get-oid",
            scope: requiredScopes.join(" "),
          });

          await callGetPermissions(token, {}, baseUrl);

          const name = "Get Display Name Test";
          await callTool(
            token,
            "set_display_name",
            { display_name: name },
            baseUrl,
          );

          const { result } = await callTool<{ display_name: string | null }>(
            token,
            "get_display_name",
            {},
            baseUrl,
          );
          assertEquals(
            result?.display_name,
            name,
            "get_display_name must return the previously set name",
          );
        },
      );
    });
  });
});
