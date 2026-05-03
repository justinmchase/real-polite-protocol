---
id: mcp-auth-008
title: MCP endpoint supports cross-origin browser clients
---

# Cross-Origin Access (CORS)

The `/mcp` endpoint MUST be reachable from browser-based MCP clients hosted at
arbitrary origins. Because the endpoint authenticates with bearer tokens (never
cookies) and is served exclusively over TLS in production, DNS-rebinding
protection via strict same-origin Origin checks is unnecessary and would block
legitimate browser clients.

## Expected behavior

- `OPTIONS /mcp` (CORS preflight) MUST succeed without authentication and
  return appropriate `Access-Control-Allow-*` headers.
- Non-preflight `/mcp` responses MUST include `Access-Control-Allow-Origin`
  (echoing the request `Origin` when present, otherwise `*`) and `Vary: Origin`.
- Responses MUST expose `WWW-Authenticate` and `Mcp-Session-Id` via
  `Access-Control-Expose-Headers` so cross-origin clients can read them.
- The Origin header MUST NOT be used to reject otherwise-valid requests; any
  origin is accepted at the transport layer (auth still gates access).
