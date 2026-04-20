---
id: domain-admin-009
title: Domain administrators can set verified metadata for any user
---

# Set User Verified Metadata (Admin)

The MCP server SHOULD expose `set_user_verified_metadata` for domain
administrators to create or update verified metadata for any user by OID.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool accepts a target user `oid` and a map of arbitrary string field
  names to string values. The admin supplies the values directly — the token
  is not consulted.
- This is the authoritative admin override path: admins can set any field to
  any value for any registered user, independent of what the user's token
  contains.
- Updated metadata is visible through subsequent `get_user_verified_metadata`
  and `list_verifiable_users` calls.
- The tool returns the resulting verified metadata record for the target user.
