import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test("req:account-001 - Account identity maps uniquely and stably to oid", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step("same oid resolves to same stable account id", async () => {
        const token1 = await issueToken({
          oid: "account-identity-oid-a",
          scope: requiredScopes.join(" "),
        });
        const token2 = await issueToken({
          oid: "account-identity-oid-a",
          scope: requiredScopes.join(" "),
        });

        const first = await callGetPermissions(token1, {}, baseUrl);
        const second = await callGetPermissions(token2, {}, baseUrl);

        assertEquals(first.oid, "account-identity-oid-a");
        assertEquals(second.oid, "account-identity-oid-a");
        assertEquals(first.account_id, second.account_id);
        assertExists(first.account_id);
      });

      await t.step(
        "different oid resolves to different account id",
        async () => {
          const tokenA = await issueToken({
            oid: "account-identity-oid-a",
            scope: requiredScopes.join(" "),
          });
          const tokenB = await issueToken({
            oid: "account-identity-oid-b",
            scope: requiredScopes.join(" "),
          });

          const accountA = await callGetPermissions(tokenA, {}, baseUrl);
          const accountB = await callGetPermissions(tokenB, {}, baseUrl);

          assertNotEquals(accountA.account_id, accountB.account_id);
          assertEquals(accountA.oid, "account-identity-oid-a");
          assertEquals(accountB.oid, "account-identity-oid-b");
        },
      );
    });
  });
});
