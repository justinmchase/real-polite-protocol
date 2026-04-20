---
id: account-006
title: MCP exposes permission introspection tool for current account
---

# Permission Introspection Tool

The MCP server MUST expose a tool that returns the current account's effective
permission levels so agents can adapt behavior safely.

## Expected behavior

- The server exposes a tool named `get_permissions`.
- The tool returns permissions for the currently authenticated account only.
- The tool response includes at least:
  - `account_id`
  - `oid`
  - `roles` (as resolved from token claims)
  - `is_domain_admin` (true when `roles` includes `domain.admin`)
  - `allowed_tool_groups` (e.g., listener tools, domain tools)
- The tool MUST NOT accept arbitrary account identifiers for lookup.
- The tool output reflects the effective permissions for the current request
  context.
