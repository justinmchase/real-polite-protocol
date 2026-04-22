import { assertEquals } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test("req:account-005 - Domain role authorization derives from token roles claim", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step(
        "domain.admin in token roles grants domain-level permissions",
        async () => {
          const token = await issueToken({
            oid: "domain-role-admin-oid",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);

          assertEquals(permissions.is_domain_admin, true);
          assertEquals(permissions.allowed_tool_groups, ["listener", "domain"]);
        },
      );

      await t.step(
        "absence of domain.admin keeps account in listener-only permissions",
        async () => {
          const token = await issueToken({
            oid: "domain-role-user-oid",
            roles: ["rpp.user"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);

          assertEquals(permissions.is_domain_admin, false);
          assertEquals(permissions.allowed_tool_groups, ["listener"]);
        },
      );

      await t.step(
        "mutable request arguments do not override token-derived role evaluation",
        async () => {
          const token = await issueToken({
            oid: "domain-role-user-oid-2",
            roles: ["rpp.user"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {
            roles: ["domain.admin"],
            is_domain_admin: true,
          }, baseUrl);

          assertEquals(permissions.is_domain_admin, false);
          assertEquals(permissions.roles, ["rpp.user"]);
        },
      );
    });
  });
});
