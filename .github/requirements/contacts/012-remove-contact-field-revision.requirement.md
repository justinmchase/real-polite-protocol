---
id: contacts-012
title: Owner can remove a specific revision from a contact field's history
spec_ref: "11.7, 12.4"
---

## Requirement

The authenticated local user MAY permanently remove a single historical
`ContactFieldRecord` ("revision") from a contact's field history via the
`remove_contact_field_revision` MCP tool (§11.7, §12.4). Removal is local-only
and dispatches no envelope to the remote.

## Rules

1. The tool MUST accept `contact_id`, `key`, and `recorded_at` (ISO 8601
   datetime).
2. The tool MUST locate the revision whose `recorded_at` equals the supplied
   timestamp exactly (millisecond precision) within the field history for the
   given `key` on the contact owned by the calling account.
3. The tool MUST be able to remove ANY revision in the history — not only the
   most recent.
4. When a revision is removed:
   - The surviving revisions MUST retain their original `value`, `source`, and
     `recorded_at` unchanged.
   - The relative newest-first ordering of surviving revisions MUST be
     preserved.
   - If the removed revision was the most recent, `current_fields[key]` MUST
     expose the next-most-recent surviving revision for `key`.
5. If the removed revision was the only entry for `key`:
   - The `key` MUST be removed from `fields`.
   - The `key` MUST be absent from `current_fields`.
6. The contact's `updated_at` MUST advance to the server time of the call on
   every successful removal.
7. If no contact exists for `(owner_oid, contact_id)`, the tool MUST return a
   structured not-found error (`E_CONTACT_NOT_FOUND`).
8. If the contact exists but no revision matches `(key, recorded_at)`, the tool
   MUST return `E_CONTACT_FIELD_REVISION_NOT_FOUND`.
9. A foreign account MUST NOT be able to remove revisions from a contact it does
   not own.
10. The updated contact MUST be returned in the tool response (subject to the
    secret-redaction rules in `req:contacts-004`).
