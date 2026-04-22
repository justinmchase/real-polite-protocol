---
id: invitations-005
title: Listeners can send invitations using a receptive policy ID
---

# Send Invitation

The MCP server MUST expose `send_invitation` so an authenticated listener can
send an invitation to a receiver identified by a `receptive_policy_id` and
`receiver_domain` (Section 9).

Because RPP has no user-level addresses (Section 3A), the `receptive_policy_id`
is the mechanism by which a sender identifies their target without knowing the
receiver's internal identifier. The receiver shares their domain and a
`policy_id` out-of-band (e.g., QR code, NFC, published profile). The sender
presents both when sending an invitation. The protocol flow is:

```
Receptive Policy → Invitation → Receipt → Message
```

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `receiver_domain`, `receptive_policy_id`, and
  `proposed_terms` inputs.
- The sender does **not** validate the receptive policy — the sender cannot know
  whether the receiver's policy will accept the invitation. The sender simply
  attaches the `receptive_policy_id` to the invitation envelope and delivers it
  to the receiver's submit endpoint. It is the **receiver's** server (the submit
  endpoint / `InvitationMessageHandler`) that looks up the policy, validates its
  state (expired, closed, domain filter), resolves the `receiver_oid`, and
  stores the invitation locally.
- The tool returns the new `invitation_id` and `created_at` upon successful
  delivery to the receiver's domain.
- If the receiver's server rejects the submission (non-2xx), the tool MUST
  surface an error to the caller.
