---
id: pseudonym-invite-001
title: Send an invitation with only unverified custom claims (pseudonym)
personas: [alice, justin]
tags: [invitations, claims, custom, privacy]
---

## Steps

1. Alice calls `open_receptive_window` with `duration_seconds: 120`. Capture the
   returned `shortcode`.
2. Justin calls `send_invitation` with ONLY custom claims (no
   `include_user_claims`, no `include_admin_claims`):
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: from step 1
   - `communication_terms`:
     `{ "categories": ["correspondence"], "max_content_rating": "G" }`
   - `custom_claims`:
     `{ "pseudonym": "ShadowFox", "tagline": "just a friendly stranger" }`
     Capture `invitation_id`.
3. Alice calls `list_invitations` with `status: "pending"`, locates the
   invitation, and verifies its `claims`:
   - `claims.immutable.domain_id` is present.
   - `claims.user` is absent or empty.
   - `claims.admin` is absent or empty.
   - `claims.custom.pseudonym == "ShadowFox"`.
   - `claims.custom.tagline == "just a friendly stranger"`.
4. Alice calls `accept_invitation` with `invitation_id` and
   `local_terms: { categories: ["correspondence"], max_content_rating: "G" }`.

## Expected Outcome

- The invitation surfaced in step 3 carries the pseudonym in `claims.custom` and
  exposes no `user` or `admin` claim values.
- The invitation accepts cleanly in step 4.

## Notes

- Validates: invitations-005 (send_invitation), and that withheld verified
  identity is not leaked in `claims.user`.
