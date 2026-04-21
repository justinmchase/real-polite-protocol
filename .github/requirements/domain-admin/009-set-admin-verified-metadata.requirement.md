---
id: domain-admin-009
title: Domain administrators can set admin verified metadata
---

# Set Admin Verified Metadata

The MCP server SHOULD expose `set_admin_verified_metadata` for domain
administrators to create or update admin verified metadata for any user by OID.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool accepts a target user `oid` and a map of arbitrary string field
  names to string values. Each value MUST be a string no longer than 512
  characters. The admin supplies the values directly — the token is not
  consulted.
- The tool updates only `admin_verified_fields`; it MUST NOT modify
  `user_verified_fields`.
- This is the authoritative admin override path: when a field exists in both
  sources, the admin-supplied value wins in the effective merged
  `verified_fields` view used by the server.
- Updated metadata is visible through subsequent `get_user_verified_metadata`
  and `list_verifiable_users` calls.
- The tool returns the resulting verified metadata record for the target user.