---
id: domain-admin-007
title: Domain administrators can list verifiable users
---

# List Verifiable Users

The MCP server SHOULD expose `list_verifiable_users` for domain administrators
to list users whose metadata can be verified by the domain.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool lists all registered accounts and their effective merged
    `verified_fields`.
- Because verified metadata is seeded at account creation (requirement account-002),
  every registered account appears in the list even if no admin override has been applied.
- When a field exists in both `user_verified_fields` and `admin_verified_fields`,
    the listed effective value comes from the admin source.
- The tool supports resume-token pagination via optional `page_size` and
    `resume_token` inputs.
- The response includes optional `next_resume_token`; absence indicates the
    end of results.
- The output is suitable for selecting users for metadata maintenance.
