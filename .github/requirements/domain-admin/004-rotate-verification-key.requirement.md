---
id: domain-admin-004
title: Domain administrators can rotate the invitation verification key
---

# Rotate Verification Key

The MCP server SHOULD expose `rotate_verification_key` for domain
administrators to rotate the active verification key used for invitation
attestation.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- Rotation creates a new active key.
- Previous active key is retained as historical key metadata.
