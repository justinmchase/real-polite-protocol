import { assertEquals } from "@std/assert";
import { start } from "../mod.ts";

export interface ToolCallResult<T = unknown> {
  status: number;
  result: T | undefined;
  body: Record<string, unknown>;
}

export interface StartedServerContext {
  kvPath: string;
}

export async function callTool<T = unknown>(
  token: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<ToolCallResult<T>> {
  const response = await fetch("http://localhost:8000/mcp", {
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
  const rawResult = body.result as { content?: Array<{ text?: string }> } | undefined;
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

export async function withStartedServer(
  run: (context: StartedServerContext) => Promise<void>,
): Promise<void> {
  const kvDir = await Deno.makeTempDir({ prefix: "rpp-test-kv-" });
  const kvPath = `${kvDir}/kv.sqlite3`;
  const controller = new AbortController();
  const started = start({ signal: controller.signal, kvPath });

  try {
    const healthy = await checkHealth();
    assertEquals(
      healthy,
      true,
      "Server did not become healthy within timeout",
    );

    await run({ kvPath });
  } finally {
    controller.abort();
    await started;
    await Deno.remove(kvDir, { recursive: true });
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function checkHealth(): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:8000/health");
      if (res.ok) {
        const body = await res.json();
        if (body.ok === true) {
          return true;
        }
      }
    } catch {
      // Server not ready yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return false;
}
