---
id: domain-admin-008
title: Domain administrators can retrieve a user's verified metadata
---

# Get User Verified Metadata

The MCP server SHOULD expose `get_user_verified_metadata` for domain
administrators to fetch verified metadata for one user.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns one record containing:
  - `user_verified_fields`
  - `admin_verified_fields`
  - the effective merged `verified_fields`
  - update timestamps for the record
- When the same field exists in both source maps, the effective merged value is
  the admin-supplied value.
- Missing users or metadata are reported using a stable error contract.
