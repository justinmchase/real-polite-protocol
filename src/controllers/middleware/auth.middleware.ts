import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { AuthService } from "../../services/auth/auth.service.ts";
import { AuthError } from "../../services/auth/auth.service.ts";

const CORS_ALLOW_HEADERS = [
  "authorization",
  "content-type",
  "mcp-session-id",
  "mcp-protocol-version",
  "x-requested-with",
].join(", ");

const CORS_ALLOW_METHODS = "GET, POST, OPTIONS, DELETE";

const CORS_EXPOSE_HEADERS = [
  "www-authenticate",
  "mcp-session-id",
].join(", ");

function applyCorsHeaders(
  headers: Headers,
  origin: string | undefined,
): void {
  // The /mcp endpoint authenticates with bearer tokens, never cookies, so we
  // do not need Access-Control-Allow-Credentials. Echo the Origin when
  // present so clients can interpret responses; fall back to "*" otherwise.
  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Expose-Headers", CORS_EXPOSE_HEADERS);
  headers.set("Access-Control-Max-Age", "600");
}

export class AuthMiddleware extends Controller {
  constructor(private readonly auth: AuthService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    // CORS preflight: must succeed without authentication so that browser-
    // based MCP clients can negotiate cross-origin access.
    app.options("/mcp", (ctx) => {
      const origin = ctx.req.header("Origin");
      const response = new Response(null, { status: 204 });
      applyCorsHeaders(response.headers, origin);
      return response;
    });

    app.all("/mcp", async (ctx, next) => {
      const origin = ctx.req.header("Origin");
      try {
        const authHeader = ctx.req.header("Authorization");
        const authInfo = await this.auth.validateBearerToken(authHeader);
        const state = ctx.var.state as Record<string, unknown>;
        state.auth = authInfo;
      } catch (e) {
        if (e instanceof AuthError) {
          // Error already logged with metadata by AuthService
          const reqOrigin = new URL(ctx.req.url).origin;
          const authorizationUri = `${reqOrigin}/authorize`;
          const apiScopePrefix = `api://${this.auth.getApiAppClientId()}`;
          const realm =
            `Bearer realm="rpp-api", authorization_uri="${authorizationUri}", resource_metadata="${reqOrigin}/.well-known/oauth-protected-resource", scope="${apiScopePrefix}/rpp.tools.read ${apiScopePrefix}/rpp.messages.submit"`;
          ctx.res.headers.set("WWW-Authenticate", realm);
          applyCorsHeaders(ctx.res.headers, origin);
          return ctx.json(
            { ok: false, error: e.message, code: e.code, metadata: e.metadata },
            e.status as unknown as 200,
          );
        }
        throw e;
      }

      await next();
      applyCorsHeaders(ctx.res.headers, origin);
    });
  }
}
