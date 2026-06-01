---
id: progressive-claims-001
title: A later invitation from the same sender extends what the receiver knows
personas: [alice, justin]
tags: [contacts, invitations, claims, privacy]
---

## Steps

1. Alice calls `open_receptive_window` with `duration_seconds: 300`. Capture
   `shortcode_a`.
2. **First invitation — pseudonym only.** Justin calls `send_invitation`:
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: `shortcode_a`
   - `communication_terms`:
     `{ categories: ["correspondence"], max_content_rating: "G" }`
   - `custom_claims`: `{ pseudonym: "ShadowFox" }`
   - NO `include_user_claims`, NO `include_admin_claims`. Capture
     `invitation_id_1`.
3. Alice calls `accept_invitation` with `invitation_id_1` and matching
   `local_terms`. Capture `contact_id_1`.
4. Alice calls `list_invitations` with `status: "accepted"`, locates
   `invitation_id_1`, and confirms its
   `claims.custom.pseudonym ==
   "ShadowFox"` and `claims.user` is absent or
   empty.
5. **Second invitation — verified identity from the same sender.** Justin calls
   `set_user_verified_metadata` (no args).
6. Alice calls `open_receptive_window` with `duration_seconds: 300`. Capture
   `shortcode_b`.
7. Justin calls `send_invitation` with:
   - `receiver_domain`: the local server's domain
   - `shortcode`: `shortcode_b`
   - `communication_terms`:
     `{ categories: ["correspondence"], max_content_rating: "G" }`
   - `include_user_claims`: `["name", "email"]`
   - NO `custom_claims`. Capture `invitation_id_2`.
8. Alice calls `accept_invitation` with `invitation_id_2` and matching
   `local_terms`. Capture `contact_id_2`.
9. Alice calls `list_invitations` with `status: "accepted"`, locates
   `invitation_id_2`, and confirms `claims.user.name` and `claims.user.email`
   are populated.

## Expected Outcome

- Step 4: `invitation_id_1` exposes only the pseudonym (no verified name or
  email) — the sender chose to withhold verified identity at this point.
- Step 9: `invitation_id_2` exposes the verified name and email — the sender
  voluntarily shared more later. The privacy property holds: withholding
  verified claims at one point does not bind the sender to never share them
  later.

## Notes

- Validates: invitations-005 (send_invitation include_user_claims and
  custom_claims), and the privacy property that a sender may progressively share
  more verified claims over time.
- Counter-scenario to `pseudonym-invite-001`: that scenario asserts withheld
  claims are not leaked at the moment of withholding; this scenario asserts the
  receiver's view is allowed to grow when the sender voluntarily shares more
  later.
