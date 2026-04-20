import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import { withAuthTestContext, requiredScopes } from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test("req:account-002 - Account is auto-provisioned on first authenticated MCP request", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async () => {
      await t.step("first authenticated call provisions account", async () => {
        const token = await issueToken({
          oid: "account-provision-oid",
          scope: requiredScopes.join(" "),
        });

        const permissions = await callGetPermissions(token);

        assertEquals(permissions.oid, "account-provision-oid");
        assertExists(permissions.account_id);
      });

      await t.step("subsequent calls resolve same account without duplication", async () => {
        const token = await issueToken({
          oid: "account-provision-oid",
          scope: requiredScopes.join(" "),
        });

        const first = await callGetPermissions(token);
        const second = await callGetPermissions(token);

        assertEquals(first.account_id, second.account_id);
        assertEquals(first.oid, second.oid);
      });
    });
  });
});
