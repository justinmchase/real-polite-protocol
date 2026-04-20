---
id: domain-admin-005
title: Domain administrators can list archived verification keys
---

# List Historical Keys

The MCP server SHOULD expose `list_historical_keys` for domain administrators to
inspect archived verification keys.

## Expected behavior

- The tool is available only to authenticated accounts with `domain.admin`.
- The tool returns archived key identifiers and archive metadata.
- The tool supports resume-token pagination via optional `page_size` and
  `resume_token` inputs.
- The response includes optional `next_resume_token`; absence indicates the
  end of results.
- The output supports verification of older attestations.
