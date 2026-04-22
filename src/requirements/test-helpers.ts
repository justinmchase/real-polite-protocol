import { assertEquals, assertExists } from "@std/assert";
import { start } from "../mod.ts";

export interface ToolCallResult<T = unknown> {
  status: number;
  result: T | undefined;
  body: Record<string, unknown>;
}

export interface StartedServerContext {
  kvPath: string;
  port: number;
  baseUrl: string;
  callTool: <T = unknown>(
    token: string,
    toolName: string,
    args?: Record<string, unknown>,
  ) => Promise<ToolCallResult<T>>;
  submitMessage: (opts: Omit<SubmitMessageOptions, "baseUrl">) => Promise<Response>;
  callGetPermissions: (
    token: string,
    args?: Record<string, unknown>,
  ) => Promise<PermissionLevels>;
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

// ---------- HMAC + submit helpers ----------

export async function computeHmac(
  receiptSecret: string,
  timestamp: string,
  bodyBytes: Uint8Array,
): Promise<string> {
  const key = new TextEncoder().encode(receiptSecret);
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix, 0);
  combined.set(bodyBytes, prefix.length);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, combined);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SubmitMessageOptions {
  receiptId: string;
  receiptSecret: string;
  messageId?: string;
  timestamp?: string;
  senderDomain?: string;
  category?: string;
  baseUrl?: string;
}

export async function submitMessage(opts: SubmitMessageOptions): Promise<Response> {
  const {
    receiptId,
    receiptSecret,
    messageId = crypto.randomUUID(),
    senderDomain = "sender.example",
    category = "message",
  } = opts;

  const bodyJson = JSON.stringify({
    message_id: messageId,
    sender_domain: senderDomain,
    category,
    sent_at: "2026-04-20T00:00:00Z",
    message: {
      content_rating: "G",
      subject: "Test",
      body: { content_type: "text/markdown", content: "Hello." },
    },
  });
  const bodyBytes = new TextEncoder().encode(bodyJson);
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const signature = await computeHmac(receiptSecret, timestamp, bodyBytes);

  return await fetch(
    `${opts.baseUrl ?? "http://localhost:8000"}/rpp/v1/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpp-receipt-id": receiptId,
        "x-rpp-signature": signature,
        "x-rpp-timestamp": timestamp,
      },
      body: bodyJson,
    },
  );
}

// ---------- Account helpers ----------

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

// ---------- Free-port helper ----------

async function getFreePort(): Promise<number> {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

export async function withStartedServer(
  run: (context: StartedServerContext) => Promise<void>,
): Promise<void> {
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const kvDir = await Deno.makeTempDir({ prefix: "rpp-test-kv-" });
  const kvPath = `${kvDir}/kv.sqlite3`;
  const controller = new AbortController();
  const started = start({ signal: controller.signal, kvPath, port });

  const boundCallTool = <T = unknown>(
    token: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ) => callTool<T>(token, toolName, args, baseUrl);

  const boundSubmitMessage = (opts: Omit<SubmitMessageOptions, "baseUrl">) =>
    submitMessage({ ...opts, baseUrl });

  const boundCallGetPermissions = (
    token: string,
    args: Record<string, unknown> = {},
  ) => callGetPermissions(token, args, baseUrl);

  try {
    const healthy = await checkHealth(port);
    assertEquals(
      healthy,
      true,
      "Server did not become healthy within timeout",
    );

    await run({
      kvPath,
      port,
      baseUrl,
      callTool: boundCallTool,
      submitMessage: boundSubmitMessage,
      callGetPermissions: boundCallGetPermissions,
    });
  } finally {
    controller.abort();
    await started;
    await Deno.remove(kvDir, { recursive: true });
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function checkHealth(port: number): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
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
