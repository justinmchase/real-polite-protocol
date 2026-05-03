export interface ToolListEntry {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ToolsListResult {
  tools: ToolListEntry[];
}

export async function callToolsList(
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
