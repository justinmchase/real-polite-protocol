---
id: mcp-003
title: MCP endpoint operates in stateless (session-less) mode
---

# MCP Stateless Transport

The MCP endpoint MUST operate in stateless mode on every deployment target. No
in-process session state is maintained between requests.

## Rationale

RPP is deployed on Deno Deploy, a serverless edge platform where each isolate
can be evicted at any time and multiple isolates may run simultaneously. A
stateful MCP session relies on an in-memory session map and a long-lived
`Deno.Kv.watch` loop per connected user. Both are fundamentally incompatible
with this environment:

- The watch loop keeps the isolate alive indefinitely, draining free compute for
  even a single connected client.
- When the isolate is evicted, the in-memory session map is destroyed. VS Code
  presents the now-unknown `Mcp-Session-Id` on the next request, receives a 404,
  and reinitializes — starting a new watch loop on the new isolate while the old
  one may still be running. This creates a reconnect cascade that multiplies
  compute usage.

Stateless mode eliminates both problems: each request is self-contained, the
isolate can go idle seconds after a tool call completes, and multi-instance
correctness is guaranteed by construction.

## Expected behavior

- A `POST /mcp` request with an `initialize` body MUST return a valid
  `InitializeResult`.
- The `InitializeResult` response MUST NOT include an `Mcp-Session-Id` header.
  The server does not assign session identifiers.
- The `InitializeResult` capabilities MUST NOT declare
  `resources.subscribe: true`. There is no SSE push channel for resource change
  notifications.
- A `POST /mcp` request with any other JSON-RPC method (e.g. `tools/list`,
  `tools/call`) MUST be processed independently, without requiring a prior
  session or `Mcp-Session-Id` header.
- A `GET /mcp` request MUST return HTTP 405 Method Not Allowed. The server does
  not offer an SSE push channel at the MCP endpoint.
