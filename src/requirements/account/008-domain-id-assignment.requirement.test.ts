import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test({
  name: "req:account-008 - Accounts are assigned an immutable domain_id at creation",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        const oid = crypto.randomUUID();
        const adminOid = crypto.randomUUID();
        const token = await issueToken({
          oid,
          scope: requiredScopes.join(" "),
          name: "Domain ID User",
        });
        const adminToken = await issueToken({
          oid: adminOid,
          roles: ["domain.admin"],
          scope: requiredScopes.join(" "),
        });

        await t.step("account has a domain_id in admin_verified_fields after provisioning", async () => {
          await callGetPermissions(token);

          const metadata = await callTool(adminToken, "get_user_verified_metadata", { oid });
          assertEquals(metadata.status, 200);
          const text = (
            metadata.body.result as { content?: Array<{ text?: string }> }
          ).content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            admin_verified_fields?: Record<string, string>;
          };
          const domainId = payload.admin_verified_fields?.domain_id;
          assertExists(domainId, "domain_id should be present in admin_verified_fields");
          assertMatch(
            domainId,
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            "domain_id should be a UUID",
          );
        });

        await t.step("domain_id is distinct from the account oid", async () => {
          const metadata = await callTool(adminToken, "get_user_verified_metadata", { oid });
          const text = (
            metadata.body.result as { content?: Array<{ text?: string }> }
          ).content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            admin_verified_fields?: Record<string, string>;
          };
          const domainId = payload.admin_verified_fields?.domain_id;
          assertExists(domainId);
          assertEquals(
            domainId !== oid,
            true,
            "domain_id must be distinct from the token oid",
          );
        });

        await t.step("domain_id is stable across multiple requests", async () => {
          const first = await callTool(adminToken, "get_user_verified_metadata", { oid });
          const second = await callTool(adminToken, "get_user_verified_metadata", { oid });
          const parse = (res: typeof first) => {
            const text = (res.body.result as { content?: Array<{ text?: string }> })
              .content?.[0]?.text;
            assertExists(text);
            return (JSON.parse(text) as { admin_verified_fields?: Record<string, string> })
              .admin_verified_fields?.domain_id;
          };
          assertEquals(parse(first), parse(second), "domain_id must be stable across requests");
        });
      });
    });
  },
});
