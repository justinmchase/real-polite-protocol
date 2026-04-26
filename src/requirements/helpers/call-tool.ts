export interface ToolCallResult<T = unknown> {
  status: number;
  result: T | undefined;
  body: Record<string, unknown>;
}

export async function callTool<T = unknown>(
  token: string,
  toolName: string,
  args: Record<string, unknown> = {},
  baseUrl = "http://localhost:8000",
): Promise<ToolCallResult<T>> {
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
      params: { name: toolName, arguments: args },
    }),
  });
  const body = await response.json() as Record<string, unknown>;
  const rawResult = body.result as
    | { content?: Array<{ text?: string }> }
    | undefined;
  const text = rawResult?.content?.[0]?.text;
  let result: T | undefined;
  if (text !== undefined) {
    try {
      result = JSON.parse(text) as T;
    } catch {
      result = undefined;
    }
  }
  return { status: response.status, result, body };
}
