---
id: cancel-invitation-001
title: Cancel a pending invitation prevents acceptance
personas: [alice, justin]
tags: [invitations, cancel]
---

## Steps

1. Alice calls `open_receptive_window` with `duration_seconds: 120`. Capture the
   returned `shortcode`.
2. Justin calls `send_invitation` with:
   - `receiver_domain`: the local server's domain (`localhost:<port>`)
   - `shortcode`: from step 1
   - `communication_terms`:
     `{ "categories": ["correspondence"], "max_content_rating": "G" }` Capture
     `invitation_id`.
3. Justin calls `cancel_invitation` with `invitation_id` and confirms the
   returned invitation has `status: "cancelled"`.
4. Justin calls `list_sent_invitations` with `status: "cancelled"` and confirms
   the invitation appears there.
5. Alice attempts `accept_invitation` with the cancelled `invitation_id`. The
   call MUST fail.

## Expected Outcome

- After step 3, `cancel_invitation` returns the invitation with
  `status: "cancelled"`.
- Step 4's listing includes the cancelled invitation.
- Step 5's accept attempt fails (cancelled invitations cannot be accepted).

## Notes

- Validates: invitations-009 (cancel_invitation), and that cancelled invitations
  are not acceptable by the receiver.
