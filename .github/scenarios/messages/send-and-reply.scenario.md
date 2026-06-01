---
id: send-and-reply-001
title: Alice sends a message to Justin and Justin replies
personas: [alice, justin]
tags: [messages, smoke]
---

## Steps

1. Justin calls `set_user_verified_metadata` and Alice calls
   `set_user_verified_metadata` to publish their token-sourced verified
   metadata.
2. Justin calls `open_receptive_window` with `duration_seconds: 120`. Capture
   `justin_shortcode`.
3. Alice calls `send_invitation` to Justin (via `justin_shortcode`) with
   `include_user_claims: ["name", "email"]` and
   `communication_terms: { categories: ["correspondence"], max_content_rating: "G" }`.
   Capture `invitation_id`.
4. Justin calls `accept_invitation` with `invitation_id` and matching
   `local_terms`. Capture `justin_contact_for_alice` (the returned
   `contact_id`).
5. Alice calls `list_contacts` and captures her contact for Justin as
   `alice_contact_for_justin` (the contact whose `remote_domain` matches the
   local server domain and whose status reflects the just-accepted invitation).
6. Alice calls `send_message` with:
   - `contact_id`: `alice_contact_for_justin`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Original message`
   - `body`:
     `{ content_type: "text/markdown", content: "This is the original." }`
     Capture the returned `message_id` as `original_message_id`.
7. Justin calls `list_messages`, locates the original message by `message_id`,
   and confirms `read: false` and `message.subject == "Original message"`.
8. Justin calls `mark_read` with `message_ids: [original_message_id]`.
9. Justin calls `send_message` with:
   - `contact_id`: `justin_contact_for_alice`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Re: Original message`
   - `body`: `{ content_type: "text/markdown", content: "This is the reply." }`
   - `metadata`: `{ in_reply_to: original_message_id }`
10. Alice calls `list_messages` and confirms she received the reply with
    `metadata.in_reply_to == original_message_id`.

## Expected Outcome

- Step 7: Justin sees Alice's original message unread, and `sender_fields.name`
  carries Alice's verified name with `source == "sender_verified"`.
- Step 8: `mark_read` reports the message in its `marked` array.
- Step 10: Alice sees Justin's reply with `subject == "Re: Original message"`
  and `metadata.in_reply_to == original_message_id`.

## Notes

- Validates: messages-001 (send), messages-002 (list), messages-004 (mark read),
  messages-006 (sender_fields with verified identity), and free-form
  `metadata.in_reply_to` pass-through.
- True two-party reply flow (no self-loop).
