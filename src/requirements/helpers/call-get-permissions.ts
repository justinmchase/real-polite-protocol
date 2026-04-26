import { assertEquals, assertExists } from "@std/assert";

export interface PermissionLevels {
  account_id: string;
  oid: string;
  roles: string[];
  is_domain_admin: boolean;
  allowed_tool_groups: string[];
}

export async function callGetPermissions(
  token: string,
  args: Record<string, unknown> = {},
  baseUrl = "http://localhost:8000",
): Promise<PermissionLevels> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "req-1",
      method: "tools/call",
      params: { name: "get_permissions", arguments: args },
    }),
  });

  assertEquals(response.status, 200);

  const payload = await response.json() as {
    result?: { content?: Array<{ text?: string }> };
  };
  const text = payload.result?.content?.[0]?.text;
  assertExists(text);
  return JSON.parse(text) as PermissionLevels;
}
