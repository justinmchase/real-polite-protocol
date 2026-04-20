---
id: mcp-auth-001
title: Server exposes MCP endpoint for listener workflows
---

# MCP Endpoint Exposure

The server MUST expose an MCP-over-HTTP endpoint for authenticated listener
workflows. The endpoint path is implementation-defined and SHOULD default to
`/mcp`.

## Expected behavior

- The service registers an MCP HTTP endpoint.
- The endpoint accepts MCP requests from authenticated listeners.
- The endpoint path is stable and documented for clients.
