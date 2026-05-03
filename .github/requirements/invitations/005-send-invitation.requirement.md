---
id: invitations-005
title: Listeners can send invitations via a receptive policy ID or a receipt ID
---

# Send Invitation

The MCP server MUST expose `send_invitation` so an authenticated listener can
send an invitation to a receiver identified by either a `receptive_policy_id` or
a `receipt_id`, together with `receiver_domain` (Sections 9, 9.1.6).

RPP supports two addressing mechanisms for outgoing invitations:

1. **Policy-based** — the receiver shares a `receptive_policy_id` out-of-band
   (e.g., QR code, NFC, published profile). The sender does not know the
   receiver's internal identifier; the receiver's submit endpoint resolves it
   from the policy. Typical first-contact flow:

   ```
   Receptive Policy → Invitation → Receipt → Message
   ```

2. **Receipt-based** — the sender already holds a `receipt_id` from a prior
   accepted invitation. They may re-invite the receiver by supplying that
   `receipt_id` instead of a policy ID. The receiver's server looks up the
   receipt, verifies an active `mode: "receipt"` policy exists for it, and
   routes the invitation to the correct account (Section 9.1.6). Typical
   relationship-refresh flow:

   ```
   Existing Receipt → Re-Invitation → New Receipt → Message
   ```

Exactly one of `receptive_policy_id` or `receipt_id` MUST be provided; providing
both or neither is invalid.

## Expected behavior

- The tool is available to any authenticated account.
- The tool requires `receiver_domain` and `proposed_terms`.
- The caller MUST supply exactly one of `receptive_policy_id` or `receipt_id`.
- The sender does **not** validate the policy or receipt client-side — the
  sender simply attaches whichever identifier was provided to the invitation
  envelope and delivers it to the receiver's envelope endpoint. It is the
  **receiver's** server (`InvitationMessageHandler`) that looks up the policy or
  receipt, validates its state, resolves the `receiver_oid`, and stores the
  invitation locally.
- The server MUST attach a `delivery` block to every outbound invitation
  envelope (Section 9.7.1). The block MUST include the sender's `domain` and a
  freshly generated single-use `token` (≥128 bits of entropy) that will serve as
  the HMAC key for the eventual receipt-callback (Section 9.7.2). The server
  MUST persist the `(invitation_id, delivery_token)` pair locally so the future
  callback can be authenticated. Tokens MUST NOT be reused across invitations.
- The tool returns the new `invitation_id` and `created_at` upon successful
  delivery to the receiver's domain.
- If the receiver's server rejects the submission (non-2xx), the tool MUST
  surface an error to the caller.

## Same-domain (local) delivery

When `receiver_domain` equals the sender's own domain the envelope MUST be
delivered by calling the local invitation manager directly, **without** making
an outbound HTTP request. This bypasses the edge-runtime self-loop restriction
(HTTP 508 "Loop Detected" returned by Deno Deploy when a deployment fetches its
own domain) and allows two users on the same server to exchange invitations.

- The local delivery path MUST produce the same observable result as the remote
  HTTP path: the invitation is stored as `pending`, the `delivery` block is
  present, and the tool returns `invitation_id` and `created_at`.
- The `delivery.token` MUST still be generated and persisted so receipt
  callbacks remain authenticatable when the invitation is later accepted.
