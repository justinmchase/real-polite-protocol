---
id: messages-009
title: send_message validates reply_invite.receptive_policy_id
spec_ref: "8.1, 8.4"
---

# Reply-invite validation in send_message

When the `send_message` MCP tool is called with a `reply_invite` (Section 8),
the server MUST verify that `reply_invite.receptive_policy_id` references an
active receptive policy on this server that is owned by the calling account.

This prevents a sender from advertising a `reply_invite` whose policy does not
exist or belongs to another account, which would later cause the receiver's
reply attempt to fail with a confusing "policy not found" error against an
unrelated server (Section 8.4).

## Expected behavior

- If `reply_invite` is omitted, the tool MUST NOT perform any reply-invite
  validation and MUST proceed normally.
- If `reply_invite.receptive_policy_id` does not reference an existing receptive
  policy on this server, the tool MUST reject the call locally with
  `E_INVALID_REPLY_INVITE` and MUST NOT contact the receiver.
- If `reply_invite.receptive_policy_id` references a receptive policy owned by a
  different account, the tool MUST reject the call locally with
  `E_INVALID_REPLY_INVITE` and MUST NOT contact the receiver.
- If `reply_invite.receptive_policy_id` references an active receptive policy
  owned by the calling account, the tool MUST proceed and MUST embed the
  `reply_invite` in the outbound envelope unchanged (apart from forcing
  `receiver_domain` to this server's own domain).

## Out of scope

- Validating `proposed_terms` content (informational per §8.1).
- Detecting policy expiry between `send_message` and the receiver's reply
  attempt (covered by §8.4 — the receiver's invitation will be rejected by the
  standard policy-not-found path at that later time).
