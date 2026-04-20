import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { AuthService } from "../../services/auth/auth.service.ts";
import { AuthError } from "../../services/auth/auth.service.ts";

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
        this.validateOriginHeader(ctx.req.url, ctx.req.header("Origin"));
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

  private validateOriginHeader(
    requestUrl: string,
    originHeader: string | undefined,
  ): void {
    if (!originHeader) {
      return;
    }

    let origin: URL;
    let requestOrigin: string;
    try {
      origin = new URL(originHeader);
      requestOrigin = new URL(requestUrl).origin;
    } catch {
      throw new AuthError("Invalid origin", 400, "E_INVALID_ORIGIN", {
        actual: originHeader,
      });
    }

    if (origin.origin !== requestOrigin) {
      throw new AuthError("Invalid origin", 400, "E_INVALID_ORIGIN", {
        actual: origin.origin,
        expected: requestOrigin,
      });
    }
  }
}
