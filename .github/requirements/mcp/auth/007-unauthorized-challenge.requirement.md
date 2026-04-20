---
id: mcp-auth-007
title: Unauthorized responses include OAuth challenge metadata
---

# Unauthorized Challenge Behavior

When an MCP request is unauthorized, the server MUST return HTTP 401 and include
`WWW-Authenticate` information that points clients to resource metadata.

## Expected behavior

- Unauthorized MCP requests return HTTP 401.
- The response includes a `WWW-Authenticate` header.
- The challenge includes a pointer to protected resource metadata so clients can
  continue OAuth discovery and authorization.
