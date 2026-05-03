import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { callGetPermissions } from "../helpers/call-get-permissions.ts";

Deno.test("req:account-006 - MCP exposes get_permissions for current account", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async ({ baseUrl }) => {
      await t.step(
        "returns domain permissions when roles includes domain.admin",
        async () => {
          const token = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);
          assertEquals(permissions.oid, "oid-domain-admin");
          assertEquals(permissions.roles, ["domain.admin"]);
          assertEquals(permissions.is_domain_admin, true);
          assertEquals(permissions.allowed_tool_groups, ["listener", "domain"]);
          assertExists(permissions.account_id);
        },
      );

      await t.step(
        "returns listener permissions without domain.admin role",
        async () => {
          const token = await issueToken({
            oid: "oid-listener",
            roles: ["rpp.user"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);
          assertEquals(permissions.oid, "oid-listener");
          assertEquals(permissions.roles, ["rpp.user"]);
          assertEquals(permissions.is_domain_admin, false);
          assertEquals(permissions.allowed_tool_groups, ["listener"]);
          assertExists(permissions.account_id);
        },
      );

      await t.step(
        "get_permissions result is always scoped to calling account regardless of extra identifier arguments",
        async () => {
          const token = await issueToken({
            oid: "oid-scoped-caller",
            scope: requiredScopes.join(" "),
          });

          // Passing a foreign oid as an argument must not affect which account is returned.
          const permissions = await callGetPermissions(
            token,
            { oid: "oid-foreign-account" },
            baseUrl,
          );

          assertEquals(
            permissions.oid,
            "oid-scoped-caller",
            "result oid must be the caller's own oid, not the argument",
          );
          assertExists(permissions.account_id);
        },
      );
    });
  });
});
