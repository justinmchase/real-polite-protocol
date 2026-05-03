import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import type { ConfigService } from "../../services/config/config.service.ts";
import type { DomainIdentityManager } from "../../managers/mod.ts";

export class AuthDiscoveryController extends Controller {
  constructor(
    private readonly config: ConfigService,
    private readonly domainIdentityManager: DomainIdentityManager,
  ) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    const domainIdentityHandler = async (
      ctx: { req: { url: string }; json: typeof Response.json },
    ) => {
      const origin = new URL(ctx.req.url).origin;

      // Include the active public key; auto-creates one on first access.
      const activeKey = await this.domainIdentityManager.getVerificationKey();
      const public_key = {
        algorithm: activeKey.public_key.algorithm,
        key: activeKey.public_key.key,
      };

      return ctx.json({
        domain: this.config.domain,
        display_name: this.config.domain,
        envelope_endpoint: `${origin}/rpp/v1/envelopes`,
        mcp_endpoint: `${origin}/mcp`,
        public_key,
      });
    };
    app.get("/.well-known/rpp-domain-identity", domainIdentityHandler);
    app.get("/.well-known/rpp-domain-identity/", domainIdentityHandler);

    const protectedResourceHandler = (
      ctx: { req: { url: string }; json: typeof Response.json },
    ) => {
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
    };
    app.get("/.well-known/oauth-protected-resource", protectedResourceHandler);
    app.get("/.well-known/oauth-protected-resource/", protectedResourceHandler);
    // RFC 9728: when the resource URL has a path component, clients may
    // look up metadata at `/.well-known/oauth-protected-resource{path}`.
    app.get(
      "/.well-known/oauth-protected-resource/mcp",
      protectedResourceHandler,
    );

    const authServerHandler = (
      ctx: { req: { url: string }; json: typeof Response.json },
    ) => {
      const origin = new URL(ctx.req.url).origin;
      const tenantId = this.config.azureTenantId;
      const audience = this.config.audience ??
        `api://${this.config.azureApiAppClientId}`;

      return ctx.json({
        issuer: origin,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        jwks_uri:
          `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
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
    };
    app.get("/.well-known/oauth-authorization-server", authServerHandler);
    app.get("/.well-known/oauth-authorization-server/", authServerHandler);
    // Resource-path-suffixed location for clients that derive AS metadata URL
    // from the protected resource path (RFC 8414 / RFC 9728 compatibility).
    app.get("/.well-known/oauth-authorization-server/mcp", authServerHandler);
    // OpenID Provider Configuration (some MCP clients probe this path).
    app.get("/.well-known/openid-configuration", authServerHandler);
    app.get("/.well-known/openid-configuration/mcp", authServerHandler);

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
      const contentType = ctx.req.header("content-type") ??
        "application/x-www-form-urlencoded";
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

    // RFC 7591 Dynamic Client Registration shim.
    //
    // Azure AD does not implement RFC 7591, but several MCP clients (e.g.
    // Codex CLI) require dynamic registration and have no way to be given a
    // pre-configured client_id. To support those clients without per-user
    // configuration, this endpoint accepts any registration request and
    // returns the pre-configured Azure public client app's client_id. The
    // public client must already be configured in Azure AD with loopback
    // redirect URIs and "Allow public client flows" enabled.
    app.post("/register", async (ctx) => {
      let body: Record<string, unknown> = {};
      try {
        const text = await ctx.req.text();
        if (text.trim()) {
          body = JSON.parse(text) as Record<string, unknown>;
        }
      } catch {
        // ignore malformed body; we still return the static client_id
      }

      const clientId = this.config.azureClientAppClientId;
      const issuedAt = Math.floor(Date.now() / 1000);
      const redirectUris = Array.isArray(body.redirect_uris)
        ? body.redirect_uris
        : [];
      const grantTypes = Array.isArray(body.grant_types)
        ? body.grant_types
        : ["authorization_code", "refresh_token"];
      const responseTypes = Array.isArray(body.response_types)
        ? body.response_types
        : ["code"];
      const clientName = typeof body.client_name === "string"
        ? body.client_name
        : "MCP Client";
      const scope = typeof body.scope === "string" ? body.scope : undefined;

      return ctx.json(
        {
          client_id: clientId,
          client_id_issued_at: issuedAt,
          // No secret — this is a public client (PKCE only).
          token_endpoint_auth_method: "none",
          grant_types: grantTypes,
          response_types: responseTypes,
          redirect_uris: redirectUris,
          client_name: clientName,
          ...(scope ? { scope } : {}),
        },
        201,
      );
    });
  }
}
