import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { AuthInfo } from "../../context.ts";
import type { Tool } from "../../tools/mod.ts";
import type { McpService } from "../../services/mcp/mcp.service.ts";

export class McpController extends Controller {
  constructor(
    private readonly mcp: McpService,
    private readonly tools: Tool[],
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

      return await this.mcp.handleRequest(ctx.req.raw, this.tools, auth);
    });
  }
}
