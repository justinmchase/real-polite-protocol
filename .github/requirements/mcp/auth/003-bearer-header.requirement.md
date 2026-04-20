---
id: mcp-auth-003
title: Bearer token is supplied only in Authorization header
---

# Bearer Header Contract

Every MCP request MUST include `Authorization: Bearer <access-token>`. Tokens
MUST NOT be provided in query parameters or request bodies.

## Expected behavior

- Requests without the `Authorization` header are rejected.
- Requests with non-bearer authorization formats are rejected.
- Requests that attempt token delivery via query or body are rejected.
- The token header requirement applies to every request in a session.
