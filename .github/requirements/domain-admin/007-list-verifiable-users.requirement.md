---
id: domain-admin-007
title: Domain administrators can list verifiable users
---

# List Verifiable Users

The MCP server SHOULD expose `list_verifiable_users` for domain administrators
to list users whose metadata can be verified by the domain.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool lists all registered accounts and their current verified metadata fields.
- Because verified metadata is seeded at account creation (requirement account-002),
  every registered account appears in the list even if no admin override has been applied.
- The output is suitable for selecting users for metadata maintenance.
