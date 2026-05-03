---
id: invitations-013
title: Listeners can update mutable fields on a public invitation they own
spec_ref: "9.4.4, 10B.4"
---

# Update Public Invitation

The MCP server MUST expose `update_public_invitation` so an authenticated
listener can update mutable fields on a public invitation they created (Section
9.4.4).

## Mutable fields

The following fields MAY be updated:

- `display_name` — replace the current value or clear it.
- `description` — replace the current value or clear it.
- `domain_filter` — replace the current filter rules or remove the filter
  entirely.

## Immutable fields

The following fields MUST NOT be altered after creation:

- `proposed_terms` — to offer different terms, the creator MUST create a new
  public invitation and optionally cancel the old one.
- `invitation_id`, `domain`, `created_at`.

## Expected behavior

- The tool requires `invitation_id`.
- Only the owning listener (by OID) MAY update the invitation. Attempts by other
  accounts MUST return a structured not-found error.
- Changes apply only to future acceptances — existing receipts derived from
  prior acceptances are unaffected.
- If the caller attempts to update `proposed_terms`, the server MUST return a
  structured error.
- The tool MUST return the updated invitation record on success.
