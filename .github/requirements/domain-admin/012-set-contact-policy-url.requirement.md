---
id: domain-admin-012
title: Domain administrators can set contact policy URL
---

# Set Contact Policy URL

The MCP server SHOULD expose `set_contact_policy_url` for domain administrators
to set or update the domain contact policy URL.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool validates and persists the provided URL.
- The updated value is reflected in subsequent reads and identity output.
