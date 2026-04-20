---
id: mcp-auth-002
title: MCP endpoint requires bearer token authentication
---

# MCP Authentication Requirement

Every client request to the MCP endpoint MUST be authenticated with OAuth
bearer tokens.

## Expected behavior

- The MCP endpoint rejects unauthenticated requests.
- The endpoint only proceeds when authentication succeeds.
- Authentication requirements apply to all MCP operations.
