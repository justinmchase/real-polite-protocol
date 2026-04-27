---
id: pseudonym-invite-001
title: Send an invitation with only unverified custom claims (pseudonym)
tags: [invitations, claims, custom]
---

## Preconditions

- Standard baseline: fresh `.data/`, server running, authenticated MCP session.

## Steps

1. Call `get_domain_identity` and capture the local `domain`.
2. Call `open_receptive_window` with `duration_seconds: 120`. Capture
   `policy_id`.
3. Call `send_invitation` with ONLY custom claims (no `include_user_claims`, no
   `include_admin_claims`):
   - `receiver_domain`: the local domain
   - `receptive_policy_id`: from step 2
   - `proposed_terms`:
     `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
   - `custom_claims`:
     `{ "pseudonym": "ShadowFox", "tagline": "just a friendly stranger" }`
     Capture `invitation_id`.
4. Call `list_invitations` with `status: "pending"` and locate the invitation.
   Verify the `claims` field on the returned invitation:
   - `claims.immutable.domain_id` is present (server always injects this).
   - `claims.user` is absent or empty.
   - `claims.admin` is absent or empty.
   - `claims.custom.pseudonym == "ShadowFox"`.
   - `claims.custom.tagline == "just a friendly stranger"`.
5. Call `accept_invitation` with the `invitation_id`. Capture `receipt.id`.
6. Call `send_message` using the receipt with:
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Hello from a pseudonym`
   - `body`: `{ "content_type": "text/markdown", "content": "Greetings." }`
7. Call `list_messages` and locate the new message.

## Expected Outcome

- The invitation in step 4 carries the pseudonym in `claims.custom` and carries
  no `user` or `admin` claim values.
- The message in step 7 has `sender_claims` that DOES NOT include `name` or
  `email` sourced from `sender_verified` (the sender chose not to expose
  verified identity).
- Custom claims are unverified — they MAY appear in `sender_claims` with
  `source == "sender_custom"`, but if the implementation only surfaces verified
  sources, `sender_claims` may be `{}`. Either is acceptable; what is NOT
  acceptable is leaking the sender's real `name`/`email` when those were not
  requested.

## Notes

- Validates: invitations-005 (send_invitation), messages-006 (sender_claims
  source rules). Demonstrates pseudonymous communication where the sender
  intentionally withholds verified identity.
- Per the `send_invitation` tool description, the agent should normally ask the
  user which claims to include. In this scenario the user has chosen "none of
  the verified claims, only this custom pseudonym".
