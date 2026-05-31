---
id: contacts-003
title: list_contacts tool
spec_ref: "11.3, 12.3, 12.8"
---

## Requirement

The server MUST expose a `list_contacts` MCP tool that returns all contacts
owned by the authenticated account (§11.3, §12.3).

## Rules

1. Returns a paginated list of contacts using resume-token pagination (§12.8).
2. Each item in the response includes `id`, `remote_domain`, `remote_domain_id`,
   `current_fields` (flat-merged most-recent value per key), `local_terms`,
   `remote_terms`, `blocked`, `created_at`, `updated_at`.
3. Results are scoped to the authenticated account (`oid`).
4. Results MAY be filtered by `blocked` (boolean) and by `remote_domain` (exact,
   case-insensitive).
5. Neither `local_credential.contact_secret` nor
   `remote_credential.contact_secret` is ever returned in the response — secrets
   stay inside the server.
