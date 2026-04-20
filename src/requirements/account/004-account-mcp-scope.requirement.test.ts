import { assertEquals, assertNotEquals } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import { withAuthTestContext, requiredScopes } from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test("req:account-004 - MCP tools are scoped to the authenticated account", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async () => {
      await t.step("tool response is scoped to caller account identity", async () => {
        const tokenA = await issueToken({
          oid: "account-scope-oid-a",
          scope: requiredScopes.join(" "),
        });
        const tokenB = await issueToken({
          oid: "account-scope-oid-b",
          scope: requiredScopes.join(" "),
        });

        const permissionsA = await callGetPermissions(tokenA);
        const permissionsB = await callGetPermissions(tokenB);

        assertEquals(permissionsA.oid, "account-scope-oid-a");
        assertEquals(permissionsB.oid, "account-scope-oid-b");
        assertNotEquals(permissionsA.account_id, permissionsB.account_id);
      });

      await t.step("tool ignores arbitrary lookup identifiers from client arguments", async () => {
        const token = await issueToken({
          oid: "account-scope-oid-caller",
          scope: requiredScopes.join(" "),
        });

        const permissions = await callGetPermissions(token, {
          account_id: "some-other-account",
          oid: "some-other-oid",
        });

        assertEquals(permissions.oid, "account-scope-oid-caller");
      });
    });
  });
});
