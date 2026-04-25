---
id: contacts-003
title: list_contacts tool
spec_ref: "10B.11"
---

## Requirement

The server MUST expose a `list_contacts` MCP tool that returns all contacts
owned by the authenticated account.

## Rules

1. Returns a paginated list of contacts using resume-token pagination (Section
   10B.10).
2. Each item in the response includes `id`, `domain`, `current_fields`
   (flat-merged most-recent value per key), `created_at`, `updated_at`.
3. Results are scoped to the authenticated account (`oid`).
