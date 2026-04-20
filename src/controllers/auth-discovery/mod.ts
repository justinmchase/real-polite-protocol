import { Controller, type GroveApp, type IContext, type IState } from "@justinmchase/grove";
import type { ConfigService } from "../../services/config/mod.ts";

export class AuthDiscoveryController extends Controller {
  constructor(private readonly config: ConfigService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    app.get("/.well-known/oauth-protected-resource", (ctx) => {
      const origin = new URL(ctx.req.url).origin;
      const apiScopePrefix = `api://${this.config.azureApiAppClientId}`;

      return ctx.json({
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ["header"],
        scopes_supported: [
          `${apiScopePrefix}/rpp.tools.read`,
          `${apiScopePrefix}/rpp.messages.submit`,
        ],
      });
    });

    app.get("/.well-known/oauth-authorization-server", (ctx) => {
      const origin = new URL(ctx.req.url).origin;
      const tenantId = this.config.azureTenantId;
      const audience = this.config.audience ??
        `api://${this.config.azureApiAppClientId}`;

      return ctx.json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        jwks_uri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
        response_types_supported: ["code"],
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "urn:ietf:params:oauth:grant-type:device_code",
        ],
        token_endpoint_auth_methods_supported: [
          "none",
          "client_secret_post",
          "client_secret_basic",
        ],
        code_challenge_methods_supported: ["S256"],
        resource: `${origin}/mcp`,
        client_id: this.config.azureClientAppClientId,
        scopes_supported: [
          "openid",
          "profile",
          "email",
          `${audience}/rpp.tools.read`,
          `${audience}/rpp.messages.submit`,
          `${audience}/.default`,
        ],
      });
    });

    app.get("/authorize", (ctx) => {
      const tenantId = this.config.azureTenantId;
      const azureAuthorizationUrl = new URL(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      );

      const requestUrl = new URL(ctx.req.url);
      for (const [key, value] of requestUrl.searchParams.entries()) {
        // Skip resource parameter for v2.0 OAuth (uses fully-qualified scopes instead)
        if (key !== "resource") {
          azureAuthorizationUrl.searchParams.set(key, value);
        }
      }

      return ctx.redirect(azureAuthorizationUrl.toString(), 302);
    });

    app.post("/token", async (ctx) => {
      const tenantId = this.config.azureTenantId;
      const azureTokenUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const contentType =
        ctx.req.header("content-type") ?? "application/x-www-form-urlencoded";
      let body = await ctx.req.text();

      // Remove resource parameter for v2.0 OAuth (uses fully-qualified scopes instead)
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(body);
        params.delete("resource");
        body = params.toString();
      }

      const upstream = await fetch(azureTokenUrl, {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });

      const responseText = await upstream.text();

      if (upstream.status !== 200) {
        console.error("Token endpoint error from Azure", {
          status: upstream.status,
          response: responseText,
          requestBody: body,
        });
      }

      const headers = new Headers();
      const upstreamContentType = upstream.headers.get("content-type");
      if (upstreamContentType) {
        headers.set("content-type", upstreamContentType);
      }

      return new Response(responseText, {
        status: upstream.status,
        headers,
      });
    });
  }
}
