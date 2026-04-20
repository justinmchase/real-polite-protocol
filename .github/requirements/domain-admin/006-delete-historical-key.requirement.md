---
id: domain-admin-006
title: Domain administrators can delete archived verification keys
---

# Delete Historical Key

The MCP server SHOULD expose `delete_historical_key` for domain administrators
to remove archived verification keys.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool deletes a specific historical key by key identifier.
- Deleting a key makes prior attestations signed by that key unverifiable.
