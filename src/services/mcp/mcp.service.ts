import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  isInitializeRequest,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "../../context.ts";
import type { Tool } from "../../tools/mod.ts";
import type { EventService } from "../events/event.service.ts";
import type { KvService } from "../kv/kv.service.ts";
import { KvEventStore } from "./kv-event-store.ts";

const INBOX_MESSAGES_URI = "rpp://inbox/messages";
const PENDING_INVITATIONS_URI = "rpp://invitations/pending";

interface Session {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  auth: AuthInfo;
  abort: AbortController;
}

/**
 * MCP transport service.
 *
 * The MCP Streamable HTTP transport supports two modes:
 *
 *  1. **Stateful sessions** — a real client (e.g. Copilot) sends an
 *     `initialize` POST first, the server allocates a session id and
 *     opens a long-lived SSE channel via `GET /mcp`. We cache the
 *     transport in `sessions` keyed by `Mcp-Session-Id` and run a
 *     per-oid KV watch loop that pushes `notifications/resources/updated`
 *     onto the SSE channel when `EventService` ticks fire.
 *
 *  2. **Stateless one-shot** — used by automated tests and any caller
 *     that just wants to invoke a single `tools/call` without an MCP
 *     handshake. We construct a fresh `McpServer` per request, run it
 *     against a stateless transport, and tear it all down before
 *     returning. No notifications, no SSE, no session state.
 *
 * Routing rules in `handleRequest`:
 *   - Has `Mcp-Session-Id` of a known session → route to that session.
 *   - Otherwise, peek at the body: if it is an `initialize` request,
 *     create a stateful session.
 *   - Otherwise, run stateless.
 */
export class McpService {
  private readonly sessions = new Map<string, Session>();
  private readonly eventStore: KvEventStore;

  private constructor(
    private readonly events: EventService,
    kv: KvService,
  ) {
    this.eventStore = new KvEventStore(kv);
  }

  static create(events: EventService, kv: KvService): McpService {
    return new McpService(events, kv);
  }

  async handleRequest(
    request: Request,
    tools: Tool[],
    auth: AuthInfo,
  ): Promise<Response> {
    const sessionId = request.headers.get("mcp-session-id");
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        return await session.transport.handleRequest(request);
      }
    }

    const { request: replayed, isInit } = await peekIsInitialize(request);
    if (isInit) {
      return await this.createStatefulSession(replayed, tools, auth);
    }
    return await this.handleStateless(replayed, tools, auth);
  }

  private async createStatefulSession(
    request: Request,
    tools: Tool[],
    auth: AuthInfo,
  ): Promise<Response> {
    const server = this.buildServer(tools, auth);

    const abort = new AbortController();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      // Use JSON responses for all POSTs (tool calls, etc.). The standalone
      // GET /mcp SSE channel carries async push notifications from the watch
      // loop. This avoids the SDK's per-POST SSE stream never closing when
      // the client negotiates a protocol version < 2025-11-25.
      enableJsonResponse: true,
      eventStore: this.eventStore,
      onsessioninitialized: (sid: string) => {
        this.sessions.set(sid, { server, transport, auth, abort });
        // Fire and forget: the watch loop runs for the lifetime of the
        // session and is cancelled via `abort` when the session closes.
        this.startWatch(server, auth, abort.signal).catch((e) => {
          console.error("[MCP] watch loop terminated:", e);
        });
      },
      onsessionclosed: (sid: string) => {
        this.closeSession(sid);
      },
    });

    await server.connect(transport);
    return await transport.handleRequest(request);
  }

  private async handleStateless(
    request: Request,
    tools: Tool[],
    auth: AuthInfo,
  ): Promise<Response> {
    const server = this.buildServer(tools, auth);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  }

  private buildServer(tools: Tool[], auth: AuthInfo): McpServer {
    const server = new McpServer(
      { name: "rpp", version: "0.1.0" },
      {
        capabilities: {
          resources: { subscribe: true, listChanged: true },
        },
      },
    );

    for (const tool of tools) {
      try {
        tool.register(server, auth);
      } catch (e) {
        console.error(
          `[MCP] Failed to register tool ${tool.constructor.name}:`,
          e,
        );
      }
    }

    this.registerInboxResources(server);
    this.registerSubscribeHandlers(server);
    return server;
  }

  private registerInboxResources(server: McpServer): void {
    server.resource(
      "inbox-messages",
      INBOX_MESSAGES_URI,
      {
        description:
          "The current user's inbox. Subscribe to receive a notification " +
          "whenever a new message is delivered; then call `list_messages` " +
          "to fetch the actual contents.",
        mimeType: "application/json",
      },
      // deno-lint-ignore require-await
      async (uri: URL) => ({
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            kind: "inbox-messages",
            hint:
              "Call list_messages to fetch the current contents of the inbox.",
            checked_at: new Date(),
          }),
        }],
      }),
    );

    server.resource(
      "pending-invitations",
      PENDING_INVITATIONS_URI,
      {
        description:
          "The current user's pending invitations. Subscribe to receive a " +
          "notification whenever a new invitation is created or its state " +
          "changes; then call `list_invitations` to fetch the contents.",
        mimeType: "application/json",
      },
      // deno-lint-ignore require-await
      async (uri: URL) => ({
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            kind: "pending-invitations",
            hint: "Call list_invitations to fetch the current invitation list.",
            checked_at: new Date(),
          }),
        }],
      }),
    );
  }

  /**
   * The high-level `McpServer` does not auto-handle `resources/subscribe`
   * even when the capability is declared. We register no-op handlers on
   * the underlying `Server` so subscribe requests succeed; actual delivery
   * is driven by `sendResourceUpdated` from the watch loop.
   *
   * For this spike every session subscribes implicitly to both inbox URIs;
   * we do not track per-uri subscriptions.
   */
  private registerSubscribeHandlers(server: McpServer): void {
    const underlying = server.server;
    // deno-lint-ignore require-await
    underlying.setRequestHandler(SubscribeRequestSchema, async () => ({}));
    // deno-lint-ignore require-await
    underlying.setRequestHandler(UnsubscribeRequestSchema, async () => ({}));
  }

  private async startWatch(
    server: McpServer,
    auth: AuthInfo,
    signal: AbortSignal,
  ): Promise<void> {
    console.log(`[MCP] startWatch for oid=${auth.oid}`);
    try {
      for await (const kind of this.events.watch(auth.oid, signal)) {
        const uri = kind === "messages"
          ? INBOX_MESSAGES_URI
          : PENDING_INVITATIONS_URI;
        console.log(
          `[MCP] event kind=${kind} → sendResourceUpdated uri=${uri}`,
        );
        try {
          await server.server.sendResourceUpdated({ uri });
          console.log(`[MCP] sendResourceUpdated ok uri=${uri}`);
        } catch (e) {
          console.error("[MCP] sendResourceUpdated failed:", e);
        }
      }
    } catch (e) {
      if (!signal.aborted) {
        console.error("[MCP] event watch loop error:", e);
      }
    }
    console.log(`[MCP] startWatch exited for oid=${auth.oid}`);
  }

  private closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    session.abort.abort();
    session.server.close().catch((e: unknown) => {
      console.error("[MCP] error closing server:", e);
    });
  }
}

/**
 * Peek the request body to determine whether it is an MCP `initialize`
 * request, and return a fresh `Request` whose body has not been consumed
 * so the transport can read it.
 *
 * MCP initialize is a JSON-RPC POST with `method: "initialize"`. Only POST
 * requests with a JSON body need to be inspected; GET (SSE) and DELETE
 * (session close) cannot be initialize.
 */
async function peekIsInitialize(
  request: Request,
): Promise<{ request: Request; isInit: boolean }> {
  if (request.method !== "POST") return { request, isInit: false };
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return { request, isInit: false };
  }
  const text = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  const isInit = Array.isArray(parsed)
    ? parsed.some((m) => isInitializeRequest(m))
    : isInitializeRequest(parsed);
  const replayed = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: text,
  });
  return { request: replayed, isInit };
}
