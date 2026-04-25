---
id: contacts-005
title: delete_contact tool
spec_ref: "10B.11"
---

## Requirement

The server MUST expose a `delete_contact` MCP tool that permanently removes a
contact record owned by the authenticated account.

## Rules

1. Takes `contact_id`.
2. Deletes the contact and all its field history.
3. Does NOT revoke any receipts associated with the contact.
4. Returns a confirmation object with `contact_id` and `deleted: true`.
5. If the contact does not exist, return a structured error.
