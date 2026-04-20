---
id: mcp-auth-010
title: MCP authentication failures use standardized HTTP status codes
---

# MCP Error Status Contract

MCP authentication and authorization errors MUST use the status mapping defined
by the RPP spec.

## Expected behavior

- HTTP 401 is returned for missing, invalid, or expired tokens.
- HTTP 403 is returned for valid tokens with insufficient scope or permissions.
- HTTP 400 is returned for malformed authorization requests or bad session
  requests.
- Error responses are stable and machine-readable for MCP clients.
