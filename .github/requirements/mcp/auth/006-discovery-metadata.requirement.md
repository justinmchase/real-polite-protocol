---
id: mcp-auth-006
title: OAuth discovery metadata is published for MCP authentication
---

# OAuth Discovery Metadata

The server MUST publish OAuth discovery metadata so MCP clients can discover how
to authenticate.

## Protected resource metadata (`/.well-known/oauth-protected-resource`)

- `/.well-known/oauth-protected-resource` is served and includes at least one
  `authorization_servers` entry pointing to the server origin.
- The metadata MUST include `bearer_methods_supported: ["header"]`.
- The metadata MUST include `scopes_supported` listing the resource-qualified
  API scopes (e.g. `api://<client-id>/rpp.tools.read`).
- The resource-path-suffixed URL `/.well-known/oauth-protected-resource/mcp`
  MUST return the same metadata (RFC 9728 §5).

## Authorization server metadata (`/.well-known/oauth-authorization-server`)

- `/.well-known/oauth-authorization-server` MUST be served and contain:
  - `issuer` — the server origin
  - `authorization_endpoint` — `/authorize` on the server origin
  - `token_endpoint` — `/token` on the server origin
  - `registration_endpoint` — `/register` on the server origin (RFC 7591)
  - `jwks_uri` — the upstream identity-provider JWKS endpoint
  - `response_types_supported` including `"code"`
  - `code_challenge_methods_supported` including `"S256"` (PKCE)
  - `token_endpoint_auth_methods_supported` including `"none"` (public client)
  - `grant_types_supported` including `authorization_code`
  - `scopes_supported` — MUST include `openid`, `offline_access`, and the
    resource-qualified API scopes. MUST NOT include a `.default` scope combined
    with resource-specific scopes (Azure AD rejects such requests with
    AADSTS70011).
  - `client_id` — the pre-configured public client app ID
  - `resource` — the protected resource URL (`<origin>/mcp`)
- The resource-path-suffixed URL `/.well-known/oauth-authorization-server/mcp`
  MUST return the same metadata.
- `/.well-known/openid-configuration` and
  `/.well-known/openid-configuration/mcp` MUST also return the same metadata to
  support MCP clients that probe the OpenID Connect discovery path.

## Dynamic Client Registration shim (`POST /register`)

Many MCP clients (e.g. Codex CLI) require RFC 7591 dynamic client registration
and have no way to be pre-configured with a client ID. Because the upstream
identity provider (Azure AD) does not implement RFC 7591, the server provides a
shim that accepts any registration request and returns the pre-configured public
client ID.

- `POST /register` MUST return HTTP 201 with a JSON body containing:
  - `client_id` — the pre-configured Azure public client app ID
  - `token_endpoint_auth_method: "none"` — signals public client (PKCE only)
  - `grant_types` — echoed from the request, or `["authorization_code"]` if
    absent
  - `response_types` — echoed from the request, or `["code"]` if absent
  - `redirect_uris` — echoed from the request, or `[]` if absent
- `POST /register` MUST succeed even when the request body is empty or omitted.
- The response MUST NOT include a `client_secret`.
