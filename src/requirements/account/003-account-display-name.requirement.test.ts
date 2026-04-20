import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

interface AccountRecord {
  id: string;
  oid: string;
  display_name?: string;
}

Deno.test("req:account-003 - Account display_name is optional and not required for MCP operations", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async () => {
      await t.step(
        "authenticated request succeeds without any display name",
        async () => {
          const token = await issueToken({
            oid: "account-display-name-oid",
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token);

          assertEquals(permissions.oid, "account-display-name-oid");
          assertExists(permissions.account_id);
        },
      );

      await t.step("new account defaults to no display_name", async () => {
        const kv = await Deno.openKv();
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
    });
  });
});
