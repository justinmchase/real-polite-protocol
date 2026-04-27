/**
 * RPP notification watcher — runs locally on the client machine.
 *
 * Connects to the RPP MCP server's Streamable HTTP transport, opens the
 * SSE channel, and fires desktop notifications whenever a
 * `notifications/resources/updated` event arrives.
 *
 * This is intentionally a client-side tool. Do NOT move notification
 * dispatch into the server — on Deno Deploy there is no local display.
 *
 * Usage:
 *   deno task notify
 *   RPP_SERVER=https://my-rpp.deno.dev deno task notify
 *
 * Environment variables:
 *   RPP_SERVER   Base URL of the RPP server (default: http://localhost:8000)
 *   RPP_TOKEN    Bearer token (optional — if omitted, fetched via `az` CLI)
 *   RPP_AZ_SCOPE Azure AD scope override (optional)
 */

import { getToken } from "../.github/skills/get-rpp-token/scripts/get-token.ts";

const server = Deno.env.get("RPP_SERVER") ?? "http://localhost:8000";
const token = await getToken();
console.log(`[rpp-notify] Connecting to ${server} …`);

// ---------------------------------------------------------------------------
// 1. Initialize an MCP session (POST initialize → get Mcp-Session-Id header)
// ---------------------------------------------------------------------------
const initResp = await fetch(`${server}/mcp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rpp-notify-watcher", version: "0.1.0" },
    },
  }),
});

if (!initResp.ok) {
  console.error(
    `[rpp-notify] Initialize failed: ${initResp.status} ${await initResp.text()}`,
  );
  Deno.exit(1);
}

const sessionId = initResp.headers.get("mcp-session-id");
if (!sessionId) {
  console.error("[rpp-notify] No Mcp-Session-Id header in initialize response.");
  Deno.exit(1);
}

// Drain the initialize response body
await initResp.body?.cancel();

console.log(`[rpp-notify] Session: ${sessionId}`);

// ---------------------------------------------------------------------------
// 2. Open the SSE channel (GET /mcp with session ID)
// ---------------------------------------------------------------------------
const sseResp = await fetch(`${server}/mcp`, {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Accept": "text/event-stream",
    "Mcp-Session-Id": sessionId,
  },
});

if (!sseResp.ok || !sseResp.body) {
  console.error(
    `[rpp-notify] SSE channel failed: ${sseResp.status} ${await sseResp.text()}`,
  );
  Deno.exit(1);
}

console.log("[rpp-notify] SSE channel open. Waiting for events…");

// ---------------------------------------------------------------------------
// 3. Parse SSE stream and dispatch desktop notifications
// ---------------------------------------------------------------------------
const reader = sseResp.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let rpcId = 2;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop()!;
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      continue;
    }
    if (
      typeof msg === "object" && msg !== null &&
      (msg as Record<string, unknown>).method ===
        "notifications/resources/updated"
    ) {
      const uri =
        ((msg as Record<string, unknown>).params as Record<string, unknown>)
          ?.uri as string ?? "";
      const kind: "messages" | "invitations" = uri.includes("messages")
        ? "messages"
        : "invitations";
      console.log(`[rpp-notify] Received update for ${uri}`);
      buildAndNotify(kind, rpcId++).catch(() => {});
    }
  }
}

console.log("[rpp-notify] SSE channel closed. Exiting.");

// ---------------------------------------------------------------------------
// Tool call helper — reuses the existing stateful MCP session
// ---------------------------------------------------------------------------
async function callTool(
  name: string,
  args: Record<string, unknown>,
  id: number,
): Promise<unknown> {
  const resp = await fetch(`${server}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId!,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  if (!resp.ok) {
    console.error(`[rpp-notify] callTool ${name} failed: ${resp.status}`);
    return null;
  }
  const json = await resp.json() as Record<string, unknown>;
  // SDK wraps tool output as content[0].text (JSON string)
  const content = (json.result as Record<string, unknown>)?.content;
  if (Array.isArray(content) && content.length > 0) {
    const text = (content[0] as Record<string, unknown>).text as string;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build notification text from live data, then fire desktop toast
// ---------------------------------------------------------------------------
async function buildAndNotify(
  kind: "messages" | "invitations",
  id: number,
): Promise<void> {
  let title: string;
  let body: string;

  if (kind === "messages") {
    const result = await callTool("list_messages", { read: false, page_size: 1 }, id) as
      | { messages: Array<{
          sender_domain: string;
          message: { body: { content: string } };
          sender_claims?: Record<string, { value: string }>;
        }> }
      | null;
    const msg = result?.messages?.[0];
    if (msg) {
      const claims = msg.sender_claims ?? {};
      const senderName =
        claims.name?.value ??
        claims.pseudonym?.value ??
        msg.sender_domain;
      const snippet = msg.message.body.content.slice(0, 120).replace(/\n/g, " ");
      title = `RPP: Message from ${senderName}`;
      body = snippet || "(no content)";
    } else {
      title = "RPP: New message";
      body = "You have a new message in your RPP inbox.";
    }
  } else {
    const result = await callTool("list_invitations", { status: "pending", page_size: 1 }, id) as
      | { invitations: Array<{
          sender_domain: string;
          claims?: Record<string, { value: string }>;
        }> }
      | null;
    const inv = result?.invitations?.[0];
    if (inv) {
      const senderName =
        inv.claims?.pseudonym?.value ??
        inv.claims?.name?.value ??
        inv.sender_domain;
      title = `RPP: Invitation from ${senderName}`;
      body = `From ${inv.sender_domain}`;
    } else {
      title = "RPP: New invitation";
      body = "You have a new pending invitation.";
    }
  }

  await notifyDesktop(title, body);
}

// ---------------------------------------------------------------------------
// Desktop notification helpers
// ---------------------------------------------------------------------------
async function notifyDesktop(title: string, body: string): Promise<void> {
  const isWsl = !!Deno.env.get("WSL_DISTRO_NAME");

  try {
    if (isWsl) {
      // Windows toast via PowerShell — available from WSL without extras
      const ps = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($t)
$nodes = $xml.GetElementsByTagName('text')
$nodes[0].AppendChild($xml.CreateTextNode(${JSON.stringify(title)})) | Out-Null
$nodes[1].AppendChild($xml.CreateTextNode(${JSON.stringify(body)})) | Out-Null
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('RPP').Show($toast)
`.trim();
      const cmd = new Deno.Command("powershell.exe", {
        args: ["-NoProfile", "-NonInteractive", "-Command", ps],
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
    } else {
      const cmd = new Deno.Command("notify-send", {
        args: ["--app-name=RPP", "--icon=mail-unread", title, body],
        stdout: "null",
        stderr: "null",
      });
      await cmd.output();
    }
  } catch {
    // notification tooling not available — silently skip
  }
}
