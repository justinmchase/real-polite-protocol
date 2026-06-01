---
id: contacts-004
title: get_contact tool
spec_ref: "11.3, 12.3"
---

## Requirement

The server MUST expose a `get_contact` MCP tool that returns a single contact by
its server-assigned `id` including the full field history (§11.3, §12.3).

## Rules

1. Takes `contact_id` (the server-assigned synthetic UUID, NOT the remote's
   `domain_id`).
2. Returns `id`, `remote_domain`, `remote_domain_id`, `current_fields`
   (flat-merged), `fields` (full history per key as an array of
   `ContactFieldRecord`), `local_terms`, `remote_terms`, `blocked`,
   `created_at`, `updated_at`.
3. The response MUST NOT include `local_credential.contact_secret` nor
   `remote_credential.contact_secret`. The `contact_id` halves of those pairs
   MAY be returned for diagnostic purposes.
4. If the contact does not exist for the authenticated account, return a
   structured not-found error.
