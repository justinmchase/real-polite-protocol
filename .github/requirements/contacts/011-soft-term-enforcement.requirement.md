---
id: contacts-011
title: Soft term enforcement on inbound and outbound messages
spec_ref: "11.5, 7"
---

## Requirement

Each contact stores two `communication_terms`-shaped records (§11.5):

- `local_terms` — categories + `max_content_rating` the **local** user is
  willing to send.
- `remote_terms` — categories + `max_content_rating` the **remote** user is
  willing to send.

Terms are advisory at the protocol level but MUST be enforced softly by the
local domain on both ends of message flow.

## Rules

1. **Outbound (`send_message` — `req:messages-001`)**:
   - The recipient is determined by `contact_id`.
   - If `category` is not in `contact.remote_terms.categories`, the tool MUST
     reject locally with `E_CATEGORY_NOT_PERMITTED` (§13) and MUST NOT make an
     outbound HTTP request.
   - If `content_rating` exceeds `contact.remote_terms.max_content_rating`, the
     tool MUST reject locally with `E_CONTENT_RATING_EXCEEDED` (§13) and MUST
     NOT make an outbound HTTP request.
2. **Inbound (`req:submit-004` — message envelope path)**:
   - The contact is resolved from `x-rpp-contact-id` (`req:submit-002`).
   - If the envelope's `category` is not in `contact.local_terms.categories`,
     reject with `E_CATEGORY_NOT_PERMITTED` (§13).
   - If the envelope's `content_rating` exceeds
     `contact.local_terms.max_content_rating`, reject with
     `E_CONTENT_RATING_EXCEEDED` (§13).
3. Enforcement is **per-message**; no state is changed when a violating message
   is rejected (no contact mutation, no auto-block).
4. Term updates are NOT supported in this protocol version. To change
   communication_terms with an existing contact, the local user MUST delete the
   contact (`req:contacts-005`) and establish a new relationship via a fresh
   invitation cycle.
5. Invitation and invitation_reply envelopes are NOT subject to term enforcement
   — terms are defined by those envelopes, not constrained by them.
