---
id: send-and-reply-001
title: Send a message to self and reply to it
tags: [messages, smoke]
---

## Preconditions

- Standard baseline: fresh `.data/`, server running, authenticated MCP session.

## Steps

1. Call `get_domain_identity` and capture the local `domain`.
2. Call `open_receptive_window` with `duration_seconds: 120`. Capture
   `policy_id`.
3. Call `send_invitation` with:
   - `receiver_domain`: the local domain
   - `receptive_policy_id`: from step 2
   - `proposed_terms`:
     `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
   - `include_user_claims`: `["name", "email"]` Capture `invitation_id`.
4. Call `accept_invitation` with the `invitation_id`. Capture the returned
   `receipt.id` as `receipt_id_A` (this is the receipt the receiver will use to
   send messages BACK to the original sender — but in a self-send both sides are
   the same account, so we use it for the initial message too).
5. Call `send_message` with:
   - `receipt_id`: `receipt_id_A`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Original message`
   - `body`:
     `{ "content_type": "text/markdown", "content": "This is the original message." }`
     Capture the returned `message_id` as `original_message_id`.
6. Call `list_messages` and locate the original message by `message_id`. Capture
   its `id` (the inbox record id) and confirm
   `message.subject == "Original message"`.
7. Call `mark_read` with `message_ids: [original_message_id]`.
8. Call `send_message` again with:
   - `receipt_id`: `receipt_id_A`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Re: Original message`
   - `body`:
     `{ "content_type": "text/markdown", "content": "This is the reply." }`
   - `metadata`: `{ "in_reply_to": original_message_id }` Capture
     `reply_message_id`.
9. Call `list_messages` and confirm both messages are present, ordered
   `received_at` descending (reply first).

## Expected Outcome

- After step 7, the original message has `read: true` (verified in step 9).
- After step 9, `list_messages` returns at least two messages:
  - Most recent: `subject == "Re: Original message"`, `read: false`,
    `metadata.in_reply_to == original_message_id`.
  - Next: `subject == "Original message"`, `read: true`.
- Both messages have `sender_claims.name.value == "Justin Chase"` (or the
  authenticated user's verified name) sourced from `sender_verified`.

## Notes

- Validates: messages-001 (send), messages-002 (list), messages-004 (mark read),
  messages-006 (sender_claims).
- The `metadata.in_reply_to` field is sender-supplied free-form metadata; the
  server passes it through but does not interpret it.
