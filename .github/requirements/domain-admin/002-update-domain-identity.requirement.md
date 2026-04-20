---
id: domain-admin-002
title: Domain administrators can update domain identity fields
---

# Update Domain Identity

The MCP server SHOULD expose `update_domain_identity` for domain administrators
to modify mutable domain identity fields.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool validates and applies updates to allowed identity fields.
- The updated identity is reflected in subsequent identity reads.
