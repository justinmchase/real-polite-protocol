---
id: contacts-004
title: get_contact tool
spec_ref: "10B.11"
---

## Requirement

The server MUST expose a `get_contact` MCP tool that returns a single contact by
ID including the full field history.

## Rules

1. Takes `contact_id` (UUID equal to the sender's `domain_id`).
2. Returns `id`, `domain`, `current_fields` (flat-merged), `fields` (full
   history per key as an array of `ContactFieldRecord`), `created_at`,
   `updated_at`.
3. If the contact does not exist for the authenticated account, return a
   structured error.
