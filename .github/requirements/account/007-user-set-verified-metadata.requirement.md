---
id: account-007
title: Users can refresh their own verified metadata from their token
---

# User Set Verified Metadata

The MCP server SHOULD expose `set_user_verified_metadata` for any authenticated
user to refresh their own verified metadata record from the identity claims in
their current bearer token.

## Expected behavior

- The tool is available to any authenticated account (no `domain.admin` role
  required).
- The tool reads identity claims from the caller's validated bearer token
  (e.g. `name`, `email`, `preferred_username`) and stores them as the caller's
  `user_verified_fields`.
- Each call replaces the caller's entire prior `user_verified_fields` map with
  the non-empty claims present in the current token. Claims absent from the
  current token are removed from the user-sourced map.
- The tool MUST NOT modify `admin_verified_fields`.
- The tool does not accept caller-supplied field values — the token is the sole
  source of truth for this operation.
- In the effective merged `verified_fields` view, admin-supplied values remain
  authoritative for any field also present in `admin_verified_fields`.
- After the call, the updated metadata is visible through `get_user_verified_metadata`
  and `list_verifiable_users`.
- The tool returns the resulting verified metadata record.
