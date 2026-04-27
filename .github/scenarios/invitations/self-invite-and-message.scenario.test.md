---
id: self-invite-001
title: Send a self-invitation, accept it, and exchange a message
tags: [smoke, invitations, messages]
---

## Preconditions

- Standard baseline only: fresh `.data/`, server started with `deno task start`,
  authenticated MCP session.

## Steps

1. Call `get_user_verified_metadata` for the authenticated user's `oid` and note
   the available `user_verified_fields` keys (expect at least `name` and
   `email`).
2. Call `get_domain_identity` and note the local `domain` value.
3. Call `open_receptive_window` with `duration_seconds: 120`. Capture the
   returned `policy_id`.
4. Call `send_invitation` with:
   - `receiver_domain`: the local domain from step 2
   - `receptive_policy_id`: the policy id from step 3
   - `proposed_terms`:
     `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
   - `include_user_claims`: `["name", "email"]` Capture the returned
     `invitation_id`.
5. Call `list_invitations` with `status: "pending"` and confirm the invitation
   from step 4 is present with the expected `claims.user.name` and
   `claims.user.email`.
6. Call `accept_invitation` with the `invitation_id` from step 4. Capture the
   returned `receipt.id`.
7. Call `send_message` with:
   - `receipt_id`: the receipt id from step 6
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Scenario test message`
   - `body`:
     `{ "content_type": "text/markdown", "content": "Hello from a scenario." }`
8. Call `list_messages` and locate the delivered message by subject.

## Expected Outcome

- The invitation transitions `pending → accepted` and a receipt is issued.
- `list_messages` returns the message from step 7 with:
  - `read: false`
  - `message.subject` equal to `"Scenario test message"`
  - `sender_claims.name.value` equal to the user's verified name
  - `sender_claims.name.source` equal to `"sender_verified"`
  - `sender_claims.email.value` equal to the user's verified email

## Notes

- Validates: invitations-005 (send), invitations-003 (accept), messages-001
  (send), messages-002 (list), messages-006 (sender_claims).
- This is the canonical smoke scenario — if it fails, broad areas of the system
  are likely broken.
