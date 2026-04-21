---
id: domain-admin-010
title: Domain administrators can remove admin verified metadata
---

# Remove Admin Verified Metadata

The MCP server SHOULD expose `remove_admin_verified_metadata` for domain
administrators to remove one admin verified metadata field for a user.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool removes the requested field from `admin_verified_fields`.
- The effective merged `verified_fields` view is recalculated after removal.
- The system reconciles invitation verification state after field removal.
