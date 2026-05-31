---
id: invitations-007
title: Senders can list invitations they have sent (outbox)
spec_ref: "10.2, 12.2"
---

# List Sent Invitations

The MCP server MUST expose `list_sent_invitations` so an authenticated local
sender can enumerate invitations they have previously originated (§10.2, §12.2).

The server MUST write an outbound invitation record for every successful
`send_invitation` or `invite_contact` call. This tool surfaces those records.

## Expected behavior

- The tool is available to any authenticated account.
- The tool returns only outbound invitation records owned by the calling account
  (by OID). Records belonging to other accounts MUST NOT be visible.
- Each returned record includes at minimum: `invitation_id`, `receiver_domain`,
  `receptive_policy_id` (or the resolved policy id when a shortcode was used),
  `communication_terms`, `status` (one of `pending`, `accepted`, `rejected`,
  `expired`, `cancelled`), `sent_at`, `expires_at`, and `contact_id` (set once
  the status reaches `accepted`).
- The tool MUST support filtering by:
  - `status` — narrow to one or more lifecycle states.
  - `receiver_domain` — exact match (case-insensitive).
  - `sent_after` / `sent_before` — ISO 8601 timestamps.
- Results MUST be ordered by `sent_at` descending by default.
- Results MUST be paginated via resume-token pagination (§12.8): request accepts
  `page_size` and `resume_token`; response returns the `invitations` array and
  an optional `next_resume_token`.
- The outbound record's locally persisted `reply_credential.contact_secret` MUST
  NOT be returned in the response.

## Outbound record lifecycle

- Status is `pending` immediately after a successful send.
- Status transitions to `accepted` when a matching inbound `invitation_reply` is
  validated and consumes the `reply_credential` (`req:invitations-008`).
- Status transitions to `cancelled` via `cancel_invitation`
  (`req:invitations-009`).
- Status transitions to `expired` when the configured `expires_at` is reached
  without an `invitation_reply`.
- Absent any `invitation_reply` and any explicit cancellation, the local domain
  MAY mark the record `rejected` only after a long inactivity window — silence
  is the protocol-level rejection signal (§10.5). The exact inactivity threshold
  is implementation-defined.
