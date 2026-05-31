---
id: mcp-auth-012
title: Azure AD/Entra ID Token v2.0 Compatibility
spec_ref: "6.2"
---

# Azure AD/Entra ID Token v2.0 Compatibility

## Requirement: Azure AD/Entra ID Token v2.0 Compatibility

The MCP server MUST support authentication using access tokens issued by
Microsoft Azure AD/Entra ID v2.0, including tokens with the following
characteristics:

### Audience (`aud`)

- Azure v2.0 tokens use the **bare application (client) ID** as the `aud` claim
  (e.g., `"03c7765e-c8c3-462f-a155-d863f44ea1ed"`), NOT the `api://` prefixed
  URI.
- The server MUST accept both the bare client ID and the `api://`-prefixed form
  as valid audience values for the configured API application.

### Issuer (`iss`)

- Azure v2.0 tokens use the issuer URL
  `https://login.microsoftonline.com/{tenant-id}/v2.0`.
- The server MUST also accept the v1.0 issuer
  `https://sts.windows.net/{tenant-id}/` for the same tenant.
- The server MUST compare issuers by extracting and matching tenant IDs,
  regardless of host or path differences between v1.0 and v2.0 formats.

### Scopes (`scp`)

- The `scp` claim is used for delegated permission scopes (e.g.,
  `"rpp.tools.read rpp.messages.submit"`) instead of `scope`.
- The server MUST extract scopes from the `scp` claim if present, and treat them
  equivalently to the `scope` claim.
- Scopes appear in short form (e.g., `rpp.tools.read`) without the `api://`
  prefix. The server MUST normalize scope names before comparison.

### Roles (`roles`)

- Azure v2.0 tokens include assigned app roles in the `roles` claim as an array
  of strings (e.g., `["domain.admin"]`).
- The server MUST read and honour the `roles` claim for authorization decisions.

### Additional claims

- The token includes Azure-specific claims such as `azp`, `azpacr`, `oid`,
  `tid`, `preferred_username`, `name`, `sid`, `amr`, and others.
- The server MUST NOT reject a valid Azure token solely due to the presence of
  these additional claims.

### Example Azure v2.0 Token Payload

```json
{
  "aud": "03c7765e-c8c3-462f-a155-d863f44ea1ed",
  "iss": "https://login.microsoftonline.com/22dddbf3-6a10-486d-94dc-b3eca6a4d13e/v2.0",
  "scp": "rpp.messages.submit rpp.tools.read",
  "roles": ["domain.admin"],
  "oid": "8c946dc0-a255-4757-8b28-52a81072a784",
  "preferred_username": "justin.m.chase@outlook.com",
  "ver": "2.0",
  ...
}
```

### Rationale

Azure AD/Entra ID is a common OAuth2 provider for enterprise environments. The
MCP server must interoperate with Azure v2.0 tokens to support real-world
deployments. The v2.0 endpoint is the recommended and current default for new
Azure app registrations.

---

**Authority:** RFC/spec > requirements > tests > code

**Test:** See
`src/requirements/mcp/auth/012-azure-token-support.requirement.test.ts`.
