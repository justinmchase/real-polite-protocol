---
id: account-007
title: Users can refresh their own verified metadata from their token
---

# User Set Verified Metadata

The MCP server SHOULD expose `set_verified_metadata` for any authenticated user
to refresh their own verified metadata record from the identity claims in their
current bearer token.

## Expected behavior

- The tool is available to any authenticated account (no `domain.admin` role
  required).
- The tool reads identity claims from the caller's validated bearer token
  (e.g. `name`, `email`, `preferred_username`) and stores them as the caller's
  verified metadata fields.
- Only non-empty claims present in the token are written; absent claims are not
  stored and do not overwrite existing values for those fields.
- The tool does not accept caller-supplied field values — the token is the sole
  source of truth for this operation.
- After the call, the updated metadata is visible through `get_user_verified_metadata`
  and `list_verifiable_users`.
- The tool returns the resulting verified metadata record.
