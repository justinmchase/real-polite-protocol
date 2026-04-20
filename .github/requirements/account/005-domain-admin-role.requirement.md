---
id: account-005
title: Domain tools require domain.admin role from token roles claim
---

# Domain Tool Role Authorization

Domain management tools (Section 10B.7) MUST be authorized using role metadata
from the authenticated bearer token. A caller is considered a domain manager
only when the token `roles` claim contains `domain.admin`.

## Expected behavior

- The server reads the `roles` claim from the validated access token.
- Domain-manager authorization evaluates membership of `domain.admin` in
  `roles`.
- Accounts whose token includes `domain.admin` MAY invoke domain tools.
- Accounts whose token does not include `domain.admin` MUST receive an
  authorization failure when invoking domain tools.
- Normal account-scoped tools (Sections 10B.1 through 10B.6) remain available
  to authenticated accounts regardless of `domain.admin` presence.
- Role evaluation is performed per request from token claims, not from mutable
  client-supplied request payload fields.
