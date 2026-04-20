import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { AuthService } from "../../services/auth/mod.ts";
import { AuthError } from "../../services/auth/mod.ts";

export class AuthMiddleware extends Controller {
  constructor(private readonly auth: AuthService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.all("/mcp", async (ctx, next) => {
      try {
        const authHeader = ctx.req.header("Authorization");
        const authInfo = await this.auth.validateBearerToken(authHeader);
        const state = ctx.var.state as Record<string, unknown>;
        state.auth = authInfo;
      } catch (e) {
        if (e instanceof AuthError) {
          // Error already logged with metadata by AuthService
          const origin = new URL(ctx.req.url).origin;
          const authorizationUri = `${origin}/authorize`;
          const apiScopePrefix = `api://${this.auth.getApiAppClientId()}`;
          const realm =
            `Bearer realm="rpp-api", authorization_uri="${authorizationUri}", resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${apiScopePrefix}/rpp.tools.read ${apiScopePrefix}/rpp.messages.submit"`;
          ctx.res.headers.set("WWW-Authenticate", realm);
          return ctx.json(
            { ok: false, error: e.message, code: e.code, metadata: e.metadata },
            e.status as unknown as 200,
          );
        }
        throw e;
      }

      await next();
    });
  }
}
