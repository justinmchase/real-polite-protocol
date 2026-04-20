---
id: mcp-auth-008
title: MCP endpoint validates Origin header
---

# Origin Validation

The MCP endpoint MUST validate the `Origin` header to reduce DNS rebinding risk.

## Expected behavior

- Requests with disallowed or malformed origins are rejected.
- Accepted origins follow explicit server policy.
- Origin validation is enforced before sensitive MCP operations execute.
