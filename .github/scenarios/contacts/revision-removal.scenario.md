---
id: revision-removal-001
title: Justin removes the first and third metadata revisions, leaving the second as the current value
personas: [alice, justin]
tags: [contacts, metadata, revisions]
---

## Steps

1. Justin calls `open_receptive_window` with `duration_seconds: 300`. Capture
   `shortcode`.
2. Alice calls `send_invitation` with:
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: `shortcode` from step 1
   - `communication_terms`:
     `{ categories: ["correspondence"], max_content_rating: "G" }`. Capture
     `invitation_id`.
3. Justin calls `accept_invitation` with `invitation_id` and matching
   `local_terms`. Capture `contact_id`.
4. Justin calls `set_contact_field` with `contact_id`, `key: "nickname"`,
   `value: "Al"`. Capture `recorded_at_1` from `fields.nickname[0].recorded_at`
   in the response.
5. Justin calls `set_contact_field` with `contact_id`, `key: "nickname"`,
   `value: "Allie"`. Capture `recorded_at_2` from
   `fields.nickname[0].recorded_at`.
6. Justin calls `set_contact_field` with `contact_id`, `key: "nickname"`,
   `value: "Aliyah"`. Capture `recorded_at_3` from
   `fields.nickname[0].recorded_at`.
7. Justin calls `remove_contact_field_revision` with `contact_id`,
   `key: "nickname"`, `recorded_at: recorded_at_1` (the oldest revision).
8. Justin calls `remove_contact_field_revision` with `contact_id`,
   `key: "nickname"`, `recorded_at: recorded_at_3` (the newest revision).
9. Justin calls `get_contact` with `contact_id`.

## Expected Outcome

- After step 6, `fields.nickname` has 3 records (newest first):
  `["Aliyah", "Allie", "Al"]`. `current_fields.nickname.value == "Aliyah"`.
- After step 7, `fields.nickname` has 2 records `["Aliyah", "Allie"]`.
  `current_fields.nickname.value` is still `"Aliyah"`.
- After step 8, `fields.nickname` has 1 record `["Allie"]`.
- Step 9: `get_contact` returns `fields.nickname.length == 1`,
  `fields.nickname[0].value == "Allie"`, and the flat-merged
  `current_fields.nickname.value == "Allie"`. The second-added revision is the
  only surviving entry and is exposed as the current value.

## Notes

- Validates `contacts-012` (remove_contact_field_revision) end-to-end across
  multiple owner-supplied revisions, including removal of both the oldest and
  the newest revision, and the spec §11.7 rule that `current_fields` exposes the
  newest surviving revision after removal.
