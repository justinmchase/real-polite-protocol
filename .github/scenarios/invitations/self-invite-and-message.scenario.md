---
id: self-invite-001
title: Send a self-invitation, accept it, and exchange a message
personas: [justin]
tags: [smoke, invitations, messages]
---

## Steps

1. Justin calls `set_user_verified_metadata` (no args) to publish his
   token-sourced verified metadata (name, email).
2. Justin calls `open_receptive_window` with `duration_seconds: 120`. Capture
   the returned `shortcode`.
3. Justin calls `send_invitation` to himself:
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: from step 2
   - `communication_terms`:
     `{ "categories": ["correspondence"], "max_content_rating": "G" }`
   - `include_user_claims`: `["name", "email"]` Capture `invitation_id`.
4. Justin calls `list_invitations` with `status: "pending"`, locates the
   invitation, and verifies `claims.user.name` and `claims.user.email` are
   populated from his verified metadata.
5. Justin calls `accept_invitation` with `invitation_id` and
   `local_terms: { categories: ["correspondence"], max_content_rating: "G" }`.
   Capture `contact_id`.
6. Justin calls `send_message` using `contact_id` with:
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Scenario test message`
   - `body`:
     `{ content_type: "text/markdown", content: "Hello from a scenario." }`
7. Justin calls `list_messages` and locates the delivered message by subject.

## Expected Outcome

- The invitation transitions `pending → accepted` and a `contact_id` is issued.
- `list_messages` returns the message from step 6 with:
  - `read: false`
  - `message.subject == "Scenario test message"`
  - `sender_fields` exposes a `name` whose value matches Justin's verified name
    from his token.

## Notes

- Validates: invitations-005 (send), invitations-003 (accept), messages-001
  (send), messages-002 (list).
- Single-persona smoke scenario for the full invite → accept → message loop.
