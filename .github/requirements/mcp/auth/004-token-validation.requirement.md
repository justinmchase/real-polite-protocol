---
id: mcp-auth-004
title: Access token validation enforces audience and token validity
---

# Token Validation Rules

The MCP resource server MUST validate access tokens and reject tokens not
intended for this server.

## Expected behavior

- The server validates token integrity and expiry.
- The server validates issuer and audience for this resource.
- Tokens not issued for this server are rejected.
- Invalid or expired tokens receive HTTP 401.
- Valid tokens with insufficient scope receive HTTP 403.
