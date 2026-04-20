import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { McpService } from "../../services/mcp/mod.ts";

export class McpController extends Controller {
  constructor(private readonly mcp: McpService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.all("/mcp", async (ctx) => {
      return await this.mcp.handleRequest(ctx.req.raw);
    });
  }
}
