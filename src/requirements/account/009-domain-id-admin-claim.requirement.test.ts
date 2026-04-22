import { assertEquals, assertExists } from "@std/assert";
import { callTool, withStartedServer } from "../test-helpers.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../mcp/auth/test-helpers.ts";
import { callGetPermissions } from "./test-helpers.ts";

Deno.test({
  name: "req:account-009 - domain_id is an immutable admin-verified claim",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async () => {
        const oid = crypto.randomUUID();
        const adminOid = crypto.randomUUID();
        const token = await issueToken({
          oid,
          scope: requiredScopes.join(" "),
          name: "Protected Field User",
        });
        const adminToken = await issueToken({
          oid: adminOid,
          roles: ["domain.admin"],
          scope: requiredScopes.join(" "),
        });

        // Provision account.
        await callGetPermissions(token);

        let originalDomainId: string | undefined;

        await t.step("domain_id appears in immutable_fields and verified_fields", async () => {
          const metadata = await callTool(adminToken, "get_user_verified_metadata", { oid });
          assertEquals(metadata.status, 200);
          const text = (
            metadata.body.result as { content?: Array<{ text?: string }> }
          ).content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            immutable_fields?: Record<string, string>;
            verified_fields?: Record<string, string>;
          };
          assertExists(payload.immutable_fields?.domain_id);
          assertExists(payload.verified_fields?.domain_id);
          originalDomainId = payload.immutable_fields?.domain_id;
        });

        await t.step("set_admin_verified_metadata rejects attempts to overwrite domain_id", async () => {
          const { status, body } = await callTool(adminToken, "set_admin_verified_metadata", {
            oid,
            verified_fields: { domain_id: "attacker-chosen-id" },
          });
          // MCP tool errors return HTTP 200 with isError on the result.
          assertEquals(status, 200);
          const mcpResult = body.result as { isError?: boolean } | undefined;
          assertEquals(mcpResult?.isError, true);
        });

        await t.step("domain_id is unchanged after rejected overwrite attempt", async () => {
          const metadata = await callTool(adminToken, "get_user_verified_metadata", { oid });
          const text = (
            metadata.body.result as { content?: Array<{ text?: string }> }
          ).content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            immutable_fields?: Record<string, string>;
          };
          assertEquals(
            payload.immutable_fields?.domain_id,
            originalDomainId,
            "domain_id must be unchanged after rejected overwrite",
          );
        });

        await t.step("remove_admin_verified_metadata rejects attempts to delete domain_id", async () => {
          const { status, body } = await callTool(adminToken, "remove_admin_verified_metadata", {
            oid,
            field: "domain_id",
          });
          assertEquals(status, 200);
          const mcpResult = body.result as { isError?: boolean } | undefined;
          assertEquals(mcpResult?.isError, true);
        });

        await t.step("domain_id is still present after rejected remove attempt", async () => {
          const metadata = await callTool(adminToken, "get_user_verified_metadata", { oid });
          const text = (
            metadata.body.result as { content?: Array<{ text?: string }> }
          ).content?.[0]?.text;
          assertExists(text);
          const payload = JSON.parse(text) as {
            immutable_fields?: Record<string, string>;
          };
          assertExists(
            payload.immutable_fields?.domain_id,
            "domain_id must still be present after rejected remove",
          );
        });
      });
    });
  },
});
