---
description: RPP servers SHOULD deploy single-tenant-per-instance for data isolation by design.
rfc_section: 15. Deployment Architecture
requirement_id: req:deployment-001
---

# Single-Tenant-Per-Instance Deployment

## Requirement

The RPP server implementation SHOULD deploy one server instance per domain to
ensure data isolation by design.

This architectural decision prioritizes security and operational simplicity over
multi-tenant resource consolidation.

## Rationale

- **Data Isolation by Design**: Each domain's persistent state (KV store, user
  metadata, receipts, domain keys) is isolated at the infrastructure level, not
  by code discipline.
- **Reduced Attack Surface**: Cross-domain data leakage risks are eliminated; a
  bug or compromise in one domain's instance does not affect other domains.
- **Compliance**: Easier to satisfy data residency and audit requirements when
  domains are segregated.
- **Operational Simplicity**: No need to manually prefix all record identifiers
  or thread domain context through every function.
- **Independent Lifecycle**: Each domain can be scaled, updated, or rolled back
  independently.

## Implementation Notes

- For a single-domain RPP server (the reference implementation), this
  requirement is satisfied by default.
- When scaling to multiple domains, automate instance provisioning (e.g., with
  Terraform, GitHub Actions matrix, or a similar CD tool).
- Each instance reads its domain from configuration (environment variable or
  config file), not from database or runtime argument.
- The reference implementation uses Deno Deploy, which supports per-instance
  environment configuration.

## Testing

The reference implementation is tested as a single-domain server. Multi-domain
deployments are verified through automation (CD pipeline tests) rather than unit
tests in the codebase.

When adding a second domain, the test harness MUST verify:

1. Each domain's instance has isolated KV storage (cannot read/write other
   domain's data).
2. Authentication is enforced per-domain (a token for domain A cannot access
   domain B's MCP tools).
3. Deploying domain B does not affect domain A's running instance or data.

## Related Documents

- Section 15 (Deployment Architecture) of rpp-spec.md
- Section 14 (Security Considerations) of rpp-spec.md
