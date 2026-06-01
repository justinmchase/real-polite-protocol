import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
  type Logger,
} from "@justinmchase/grove";
import type { AuthInfo } from "../../context.ts";
import type { AccountManager } from "../../managers/mod.ts";
import type { Tool } from "../../tools/mod.ts";
import type { McpService } from "../../services/mcp/mcp.service.ts";

interface JsonRpcMessage {
  method?: string;
  params?: { name?: string };
}

function extractTools(parsed: unknown): string[] {
  const messages: JsonRpcMessage[] = Array.isArray(parsed)
    ? parsed as JsonRpcMessage[]
    : [parsed as JsonRpcMessage];
  const tools: string[] = [];
  for (const m of messages) {
    if (m?.method === "tools/call" && typeof m.params?.name === "string") {
      tools.push(m.params.name);
    }
  }
  return tools;
}

export class McpController extends Controller {
  constructor(
    private readonly mcp: McpService,
    private readonly accounts: AccountManager,
    private readonly tools: Tool[],
    private readonly logger: Logger,
  ) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.all("/mcp", async (ctx) => {
      const state = ctx.var.state as Record<string, unknown>;
      const auth = state.auth as AuthInfo | undefined;
      if (!auth) {
        return ctx.json({
          ok: false,
          error: "Unauthorized",
          code: "MISSING_AUTH",
        }, 401);
      }

      await this.accounts.ensureAccount(auth);

      // Read the body so we can log JSON-RPC method + tool name(s); rebuild
      // a fresh Request for the transport since Request bodies are one-shot.
      const original = ctx.req.raw;
      let bodyText = "";
      let tools: string[] = [];
      if (original.method !== "GET") {
        bodyText = await original.text();
        if (bodyText) {
          try {
            tools = extractTools(JSON.parse(bodyText));
          } catch {
            // ignore non-JSON bodies; transport will reject
          }
        }
      }

      this.logger.info("mcp request", {
        oid: auth.oid,
        tools,
      });

      const forwarded = new Request(original.url, {
        method: original.method,
        headers: original.headers,
        body: bodyText.length > 0 ? bodyText : undefined,
      });
      return await this.mcp.handleRequest(forwarded, this.tools, auth);
    });
  }
}
