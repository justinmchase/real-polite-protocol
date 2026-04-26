---
id: progressive-claims-001
title: Accepting a later invitation from the same sender extends contact claims
tags: [contacts, invitations, claims, privacy]
---

## Preconditions

- Standard baseline: fresh `.data/`, server running, authenticated MCP
  session.

## Steps

1. Call `get_domain_identity` and capture the local `domain`.
2. Call `open_receptive_window` with `duration_seconds: 300`. Capture
   `policy_id_A`.
3. **First invitation — pseudonym only.** Call `send_invitation`:
   - `receiver_domain`: the local domain
   - `receptive_policy_id`: `policy_id_A`
   - `proposed_terms`: `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
   - `custom_claims`: `{ "pseudonym": "ShadowFox" }`
   - NO `include_user_claims`, NO `include_admin_claims`.
   Capture `invitation_id_1`.
4. Accept it: `accept_invitation` with `invitation_id_1`.
   Capture `receipt_id_1`.
5. Send a message under the pseudonym:
   - `receipt_id`: `receipt_id_1`
   - `category`: `correspondence`
   - `content_rating`: `G`
   - `subject`: `Message under pseudonym`
   - `body`: `{ "content_type": "text/markdown", "content": "From the shadows." }`
   Capture `message_id_1`.
6. List messages and locate `message_id_1`. Verify on this message at this
   point in time:
   - `sender_claims` does NOT contain `name` or `email` with
     `source == "sender_verified"`.
   - `sender_claims.pseudonym.value == "ShadowFox"` with
     `source == "sender_custom"` (if the implementation surfaces custom
     claims; if it does not, the field MAY be absent — what matters is the
     verified-name absence).
7. **Second invitation — verified identity from the same sender domain.**
   Call `open_receptive_window` again with `duration_seconds: 300`. Capture
   `policy_id_B`.
8. Call `get_user_verified_metadata` for the current user and capture which
   user-verified fields are available (expect at least `name` and `email`).
9. Call `send_invitation`:
   - `receiver_domain`: the local domain
   - `receptive_policy_id`: `policy_id_B`
   - `proposed_terms`: `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
   - `include_user_claims`: `["name", "email"]`
   - NO `custom_claims`.
   Capture `invitation_id_2`.
10. Accept it: `accept_invitation` with `invitation_id_2`.
    Capture `receipt_id_2` (this MUST be a different receipt id from
    `receipt_id_1`).
11. Re-list messages WITHOUT sending a new message. Locate the original
    `message_id_1` (the pseudonymous message from step 5).

## Expected Outcome

- After step 6, the pseudonymous message exposes no verified `name`/`email`.
- After step 10, both invitations are tied to the SAME sender identity —
  i.e. both carry the same `claims.immutable.domain_id`. The sender is one
  party progressively sharing more.
- After step 11, listing the same `message_id_1` again now shows the newly
  shared verified claims attached to its `sender_claims`:
  - `sender_claims.name.value == "<the user's verified name>"` with
    `source == "sender_verified"`.
  - `sender_claims.email.value == "<the user's verified email>"` with
    `source == "sender_verified"`.
  - `sender_claims.pseudonym` (if surfaced earlier) MAY still be present
    with `source == "sender_custom"`.
- This is by design: the receiver's contact record accumulates claims about
  a sender keyed by the sender's stable `domain_id`. Claims are rendered on
  messages from the receiver's current knowledge of the sender, not
  snapshotted at send time. A later invitation that shares more verified
  claims legitimately extends what the receiver knows about prior messages
  from the same sender.

## Notes

- Validates: contacts behavior (claims accumulate per sender domain_id),
  invitations-005 (send_invitation include_user_claims), messages-006
  (sender_claims source rules), and the privacy property that withholding
  verified claims at one point does NOT bind the sender to never share them
  later.
- Counter-scenario to `pseudonym-invite-001`: that scenario asserts
  withheld claims are not leaked at the moment of withholding; this
  scenario asserts the receiver's view is allowed to grow when the sender
  voluntarily shares more later.
- Per the `send_invitation` tool description, the agent should normally ask
  the user which claims to include. In this scenario the user is scripted
  to choose "pseudonym only" first, then "name + email" second.
