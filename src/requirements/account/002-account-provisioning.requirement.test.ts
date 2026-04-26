import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";
import { callGetPermissions } from "../helpers/call-get-permissions.ts";

Deno.test("req:account-002 - Account is auto-provisioned on first authenticated MCP request", async (t) => {
  await withAuthTestContext(async ({ issueToken }) => {
    await withStartedServer(async ({ baseUrl, callTool }) => {
      await t.step(
        "first authenticated call provisions account and seeds user metadata",
        async () => {
          const token = await issueToken({
            oid: "account-provision-oid",
            scope: requiredScopes.join(" "),
            name: "Provisioned User",
            email: "provisioned@example.test",
          });
          const adminToken = await issueToken({
            oid: "oid-domain-admin",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const permissions = await callGetPermissions(token, {}, baseUrl);

          assertEquals(permissions.oid, "account-provision-oid");
          assertExists(permissions.account_id);

          const metadata = await callTool(
            adminToken,
            "get_user_verified_metadata",
            {
              oid: "account-provision-oid",
            },
          );
          assertEquals(metadata.status, 200);
          const text =
            (metadata.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            user_verified_fields?: Record<string, string>;
            admin_verified_fields?: Record<string, string>;
            verified_fields?: Record<string, string>;
          };

          assertEquals(payload.user_verified_fields?.name, "Provisioned User");
          assertEquals(
            payload.user_verified_fields?.email,
            "provisioned@example.test",
          );
          assertEquals(payload.admin_verified_fields, {});
          assertEquals(payload.verified_fields?.name, "Provisioned User");
        },
      );

      await t.step(
        "subsequent authenticated requests do not overwrite seeded metadata automatically",
        async () => {
          const firstToken = await issueToken({
            oid: "account-provision-stable-oid",
            scope: requiredScopes.join(" "),
            name: "First Name",
          });
          const secondToken = await issueToken({
            oid: "account-provision-stable-oid",
            scope: requiredScopes.join(" "),
            name: "Changed Name",
          });
          const adminToken = await issueToken({
            oid: "oid-domain-admin-stable",
            roles: ["domain.admin"],
            scope: requiredScopes.join(" "),
          });

          const first = await callGetPermissions(firstToken, {}, baseUrl);
          const second = await callGetPermissions(secondToken, {}, baseUrl);

          assertEquals(first.account_id, second.account_id);
          assertEquals(first.oid, second.oid);

          const metadata = await callTool(
            adminToken,
            "get_user_verified_metadata",
            {
              oid: "account-provision-stable-oid",
            },
          );
          assertEquals(metadata.status, 200);
          const text =
            (metadata.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            user_verified_fields?: Record<string, string>;
          };

          assertEquals(payload.user_verified_fields?.name, "First Name");
        },
      );
    });
  });
});
