---
id: cancel-invitation-001
title: Cancel a pending self-invitation
tags: [invitations, cancel]
---

## Steps

1. Call `open_receptive_window` with `duration_seconds: 120`. Capture
   `policy_id`.
2. Call `get_domain_identity` and capture the local `domain`.
3. Call `send_invitation` with:
   - `receiver_domain`: the local domain
   - `receptive_policy_id`: from step 1
   - `proposed_terms`:
     `{ "category": "correspondence", "max_content_rating": "G", "usage_policy": "any-time" }`
     Capture `invitation_id`.
4. Call `cancel_invitation` with the `invitation_id` from step 3.
5. Call `list_invitations` with `status: "cancelled"`.
6. Attempt to `accept_invitation` with the cancelled `invitation_id`. Expect the
   call to fail with code `E_INVITATION_NOT_PENDING`.

## Expected Outcome

- After step 4, `cancel_invitation` returns the invitation with
  `status: "cancelled"`.
- `list_invitations` (status filter `cancelled`) includes the invitation.
- The acceptance attempt in step 6 fails with HTTP 400 and code
  `E_INVITATION_NOT_PENDING` (or `E_INVITATION_NOT_CANCELLABLE` if the server
  treats already-cancelled as non-cancellable on accept paths).

## Notes

- Validates: invitations-009 (cancel_invitation).
