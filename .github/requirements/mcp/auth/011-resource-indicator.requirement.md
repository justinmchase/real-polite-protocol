---
id: mcp-auth-011
title: OAuth authorization flow uses canonical resource indicator
---

# OAuth Resource Indicator

Per the RPP MCP authorization flow, the OAuth resource indicator MUST be set to
the canonical URI of the target RPP server during authorization and token
exchange.

## Expected behavior

- Authorization flow guidance includes the canonical MCP resource URI.
- The same canonical resource is used consistently across flow steps.
- Resource targeting is unambiguous so clients obtain tokens intended for this
  server.
