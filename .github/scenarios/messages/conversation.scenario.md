---
id: conversation-001
title: Alice and Justin exchange a message and a reply
personas: [alice, justin]
tags: [smoke, messages, invitations]
---

## Steps

1. Alice calls `open_receptive_window` with `duration_seconds: 120`. Capture the
   returned `shortcode`.
2. Justin calls `send_invitation` with:
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: from step 1
   - `communication_terms`:
     `{ categories: ["correspondence"], max_content_rating: "G" }` Capture
     `invitation_id`.
3. Alice calls `accept_invitation` with `invitation_id` and matching
   `local_terms`. Capture `alice_contact_id`. Then Justin calls `list_contacts`
   and captures `justin_contact_id` for the new contact.
4. Justin calls `send_message` with:
   - `contact_id`: `justin_contact_id`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Hi Alice`
   - `body`:
     `{ content_type: "text/markdown", content: "Hi Alice, how are you?" }`
     Capture `original_message_id`. Alice then calls `list_messages` and
     confirms she received it.
5. Alice calls `send_message` back with:
   - `contact_id`: `alice_contact_id`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Re: Hi Alice`
   - `body`:
     `{ content_type: "text/markdown", content: "Hi Justin, doing well!" }`
   - `metadata`: `{ in_reply_to: original_message_id }` Justin then calls
     `list_messages` and confirms he received the reply with
     `metadata.in_reply_to == original_message_id`.

## Expected Outcome

- Step 3: `accept_invitation` returns `status: "accepted"` and a `contact_id`.
  Justin's contact list contains the matching contact.
- Step 4: Alice's inbox contains Justin's original message with
  `subject == "Hi Alice"` and `read: false`.
- Step 5: Justin's inbox contains Alice's reply with `subject == "Re: Hi Alice"`
  and `metadata.in_reply_to ==
  original_message_id`.

## Notes

- Validates the minimal end-to-end conversation flow: window → invite → accept →
  message → reply, with both directions exercised.
