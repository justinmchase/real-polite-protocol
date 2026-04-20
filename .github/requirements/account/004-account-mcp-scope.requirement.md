---
id: account-004
title: All MCP tool operations are scoped to the authenticated account
---

# Account-Scoped MCP Operations

Every MCP tool invocation MUST execute in the context of the resolved Account.
Tools MUST NOT access or mutate data belonging to other accounts.

## Expected behavior

- After bearer token validation, the server resolves the Account for the request
  and makes it available to all tool handlers.
- All MCP tools (messaging, receipts, invitations, groups, identity — Sections
  10B.1 through 10B.6) operate on data owned by the resolved Account.
- A tool that lists or fetches resources (e.g., `list_messages`, `get_receipt`)
  MUST return only records associated with the calling Account.
- A tool that creates or mutates resources MUST associate the new record with
  the calling Account.
- Domain management tools (Section 10B.7) require the domain administrator role;
  account ownership alone is not sufficient.
