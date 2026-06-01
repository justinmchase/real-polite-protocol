---
id: contacts-007
title: Owner-authored custom field on a contact
spec_ref: "11.2, 12.3"
---

## Requirement

The authenticated local user MAY add an owner-authored custom field value to any
of their contacts at any time via the `set_contact_field` MCP tool (§11.2,
§12.3).

## Rules

1. The tool MUST accept `contact_id`, `key` (field name), and `value` (string,
   number, boolean, null, or a flat array of those types up to 20 elements;
   constraints match `req:invitations-006`).
2. Calling the tool MUST prepend a new `ContactFieldRecord` to the history array
   for the given `key` on the specified contact, with:
   - `source: "owner_note"`
   - `recorded_at` set to the server time of the call.
3. Existing history entries MUST NOT be removed or overwritten.
4. The contact's `updated_at` MUST be refreshed to match the new record's
   `recorded_at`.
5. If no contact exists for the given `(owner_oid, contact_id)` pair, the tool
   MUST return a structured not-found error.
6. The updated contact MUST be returned in the tool response (subject to the
   secret-redaction rules in `req:contacts-004`).
