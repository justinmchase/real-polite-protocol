---
id: mcp-auth-006
title: OAuth discovery metadata is published for MCP authentication
---

# OAuth Discovery Metadata

The server MUST publish OAuth discovery metadata so MCP clients can discover how
to authenticate.

## Expected behavior

- `/.well-known/oauth-protected-resource` is served and includes at least one
  `authorization_servers` entry.
- `/.well-known/oauth-authorization-server` is served by the authorization
  server and contains standard OAuth metadata.
- Metadata responses are valid JSON and stable for client consumption.
