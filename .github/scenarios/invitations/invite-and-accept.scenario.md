---
id: invite-and-accept-001
title: Justin invites Alice and Alice accepts
personas: [alice, justin]
tags: [smoke, invitations]
---

## Steps

1. Alice calls `open_receptive_window` with `duration_seconds: 120`. Capture the
   returned `shortcode`.
2. Justin calls `send_invitation` with:
   - `receiver_domain`: the local server's domain (e.g. `localhost:<port>`)
   - `shortcode`: from step 1
   - `communication_terms`:
     `{ "categories": ["correspondence"], "max_content_rating": "G" }`
   - `message`: `"hi this is justin"` Capture the returned `invitation_id`.
3. Alice calls `list_invitations` with `status: "pending"` and confirms the
   invitation from step 2 is present with `direction: "inbound"` and
   `message: "hi this is justin"`.
4. Alice calls `accept_invitation` with:
   - `invitation_id`: from step 2
   - `local_terms`:
     `{ "categories": ["correspondence"], "max_content_rating": "G" }`
   - `message`: `"hi justin, accepted"` Capture the returned `contact_id`.
5. Justin calls `list_sent_invitations` with `status: "accepted"` and confirms
   the invitation from step 2 transitioned to `accepted`.

## Expected Outcome

- Alice's pending invitation list (before step 4) contains the invitation from
  Justin with the message `"hi this is justin"`.
- After step 4, Alice receives a `contact_id` for the newly created contact.
- Justin's accepted-invitations list contains the same `invitation_id` with
  status `accepted`.

## Notes

- Validates: invitations-005 (send), invitations-003 (accept), the same-domain
  delivery loop (submit-005).
- This is the canonical multi-persona smoke scenario for the invitation flow.
