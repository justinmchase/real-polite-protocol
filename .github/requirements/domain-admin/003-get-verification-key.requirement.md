---
id: domain-admin-003
title: Domain administrators can retrieve the active verification key
---

# Get Verification Key

The MCP server SHOULD expose `get_verification_key` for domain
administrators to retrieve the currently active invitation verification key
metadata.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns the active public verification key and key identifier.
- Returned key data is suitable for verification and auditing workflows.
