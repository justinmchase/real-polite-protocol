---
id: account-003
title: Account MAY have an optional display name
---

# Account Display Name

An Account MAY carry a display name. Display names are informational only and
have no protocol significance (Section 3A.2). The server MUST NOT require a
display name as a condition of account creation or any MCP operation.

## Expected behavior

- The `display_name` field on an Account is OPTIONAL and defaults to absent.
- A display name MAY be any Unicode string up to 256 code points (Section 3A.2).
- Display names MUST NOT be used for routing, authentication, or authorization.
- The listener MAY set or clear their display name at any time via the
  `set_display_name` MCP tool (Section 10B.6).
- The listener MAY retrieve their current display name via the
  `get_display_name` MCP tool (Section 10B.6).
