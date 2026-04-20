---
id: domain-admin-011
title: Domain administrators can retrieve contact policy URL
---

# Get Contact Policy URL

The MCP server SHOULD expose `get_contact_policy_url` for domain
administrators to retrieve the current domain contact policy URL.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns the configured `contact_policy_url`.
- The returned value reflects domain identity state.
