---
id: mcp-002
title: MCP server lists all registered tools via tools/list
---

# MCP Tools List

Authenticated callers MUST be able to enumerate all registered MCP tools by
issuing a `tools/list` JSON-RPC request to the MCP endpoint.

## Rationale

The MCP specification defines `tools/list` as the discovery mechanism that
clients use to learn which tools a server exposes, along with each tool's
description, `inputSchema`, and `outputSchema`. If `tools/list` fails or returns
an empty result, no client can discover what the server offers — the server is
effectively unusable even if every individual tool is functional.

A regression in tool registration (e.g. an exception thrown during
`server.registerTool` for one tool) must not silently strip tools from the
catalog or break the entire list response.

## Expected behavior

- A `POST /mcp` request with body
  `{ "jsonrpc": "2.0", "id": "...", "method": "tools/list" }` from an
  authenticated caller MUST return a 200 response.
- The response `result.tools` array MUST be non-empty.
- The response MUST include every tool that `initTools` registers in
  `src/tools/mod.ts`, identified by its registered tool name (e.g.
  `list_invitations`, `get_contact`, `set_user_verified_metadata`).
- Each listed tool entry MUST include a `name`, a `description`, and an
  `inputSchema` object.
- Each listed tool entry SHOULD include an `outputSchema` (per
  `mcp-001 - Tools use structured output with outputSchema`).
- An unauthenticated request MUST be rejected before reaching tool enumeration.
