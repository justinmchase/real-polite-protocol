---
id: domain-admin-010
title: Domain administrators can remove a specific verified metadata field
---

# Remove User Verified Field

The MCP server SHOULD expose `remove_user_verified_field` for domain
administrators to remove one verified metadata field for a user.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool removes the requested field from verified metadata.
- The system reconciles invitation verification state after field removal.
