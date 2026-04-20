---
id: mcp-auth-005
title: Client bearer tokens are never forwarded upstream
---

# Token Non-Forwarding

The MCP server MUST NOT forward bearer tokens received from clients to any
upstream service.

## Expected behavior

- Access tokens are consumed only for local authorization decisions.
- No outbound call includes the incoming bearer token unless explicitly replaced
  by service-owned credentials.
- Logging and error handling avoid leaking raw access tokens.
