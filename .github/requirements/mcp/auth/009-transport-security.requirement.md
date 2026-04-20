---
id: mcp-auth-009
title: MCP and OAuth endpoints are served over HTTPS
---

# Transport Security

All MCP and OAuth endpoints MUST be served over HTTPS.

## Expected behavior

- Production MCP endpoint traffic uses HTTPS.
- OAuth authorization and token endpoints use HTTPS.
- Non-HTTPS deployment is treated as non-compliant except in explicit local
  development contexts.
