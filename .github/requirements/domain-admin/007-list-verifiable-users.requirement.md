---
id: domain-admin-007
title: Domain administrators can list verifiable users
---

# List Verifiable Users

The MCP server SHOULD expose `list_verifiable_users` for domain administrators
to list users whose metadata can be verified by the domain.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool lists users and their verifiable metadata fields.
- The output is suitable for selecting users for metadata maintenance.
