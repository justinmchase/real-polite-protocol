---
id: domain-admin-008
title: Domain administrators can retrieve a user's verified metadata
---

# Get User Verified Metadata

The MCP server SHOULD expose `get_user_verified_metadata` for domain
administrators to fetch verified metadata for one user.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns verified fields and verification metadata for one user.
- Missing users or metadata are reported using a stable error contract.
