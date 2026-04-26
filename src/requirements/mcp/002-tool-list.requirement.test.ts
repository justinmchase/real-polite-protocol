import { assert, assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

interface ToolListEntry {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface ToolsListResult {
  tools: ToolListEntry[];
}

async function callToolsList(
  baseUrl: string,
  token: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
  };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "list-1",
      method: "tools/list",
    }),
  });
  const body = await response.json() as Record<string, unknown>;
  return { status: response.status, body };
}

Deno.test({
  name: "req:mcp-002 - MCP server lists all registered tools via tools/list",
  fn: async (t) => {
    await withAuthTestContext(async ({ issueToken }) => {
      await withStartedServer(async ({ baseUrl }) => {
        await t.step(
          "tools/list returns the full catalog of registered tools",
          async () => {
            const token = await issueToken({
              oid: crypto.randomUUID(),
              roles: ["domain.admin"],
              scope: requiredScopes.join(" "),
              name: "Test User",
            });

            const { status, body } = await callToolsList(baseUrl, token);
            assertEquals(status, 200);
            const result = body.result as ToolsListResult | undefined;
            assert(result, "tools/list response missing result");
            assert(
              Array.isArray(result.tools),
              "tools/list result.tools must be an array",
            );
            assert(
              result.tools.length > 0,
              "tools/list result.tools must be non-empty",
            );

            // Spot-check a representative sampling across each tool group.
            // The full catalog is much larger; this guards against silent
            // drop-out of an entire registration class.
            const expected = [
              // account
              "get_permissions",
              "set_user_verified_metadata",
              // contacts
              "list_contacts",
              "get_contact",
              "delete_contact",
              "set_contact_field",
              "invite_contact",
              // domain admin (requires domain.admin role)
              "get_domain_identity",
              "update_domain_identity",
              "get_user_verified_metadata",
              // receptive policy
              "open_receptive_window",
              "get_receptive_policies",
              "remove_receptive_policy",
              // invitations
              "list_invitations",
              "review_invitation",
              "accept_invitation",
              "reject_invitation",
              "send_invitation",
              // receipt
              "list_issued_receipts",
              "revoke_receipt",
              // messages
              "list_messages",
              "get_message",
              "send_message",
            ];
            const names = new Set(result.tools.map((t) => t.name));
            for (const name of expected) {
              assert(
                names.has(name),
                `tools/list missing expected tool: ${name}`,
              );
            }

            // Each entry must have name, description, and inputSchema.
            for (const tool of result.tools) {
              assert(
                typeof tool.name === "string" && tool.name.length > 0,
                `tool entry missing name`,
              );
              assert(
                typeof tool.description === "string" &&
                  tool.description.length > 0,
                `tool ${tool.name} missing description`,
              );
              assert(
                tool.inputSchema && typeof tool.inputSchema === "object",
                `tool ${tool.name} missing inputSchema`,
              );
            }
          },
        );

        await t.step(
          "tools/list rejects unauthenticated requests",
          async () => {
            const { status, body } = await callToolsList(baseUrl, undefined);
            assertEquals(status, 401);
            assertEquals(body.ok, false);
          },
        );
      });
    });
  },
});
