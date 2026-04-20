---
id: domain-admin-009
title: Domain administrators can set user verified metadata
---

# Set User Verified Metadata

The MCP server SHOULD expose `set_user_verified_metadata` for domain
administrators to create or update a user's verified metadata.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool validates and stores authoritative verified metadata values.
- Updated metadata is visible through subsequent reads and listing tools.
