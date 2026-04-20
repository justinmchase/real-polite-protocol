---
id: domain-admin-001
title: Domain administrators can retrieve domain identity
---

# Get Domain Identity

The MCP server SHOULD expose `get_domain_identity` for domain administrators.
The tool returns the current domain identity values as published by the server.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns the current domain identity object.
- Returned fields align with the server's domain identity surface.
