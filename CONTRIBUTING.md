# Contributing to RPP

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused — one concern per PR
- Follow `deno fmt` and `deno lint` (run `deno task check`)
- **Every implementation change MUST align with the spec.** If behavior,
  payloads, endpoints, auth, or error semantics are changed in code, and that
  change is not already documented in [`spec/rpp-spec.md`](spec/rpp-spec.md),
  you MUST include corresponding spec updates in the same PR.
- If you are proposing a change to the spec itself, open an issue first to
  discuss intent before writing prose.

## Spec alignment checklist (required in PR description)

- [ ] I confirmed this change is consistent with
      [`spec/rpp-spec.md`](spec/rpp-spec.md)
- [ ] If not already covered, I updated [`spec/rpp-spec.md`](spec/rpp-spec.md)
- [ ] I listed the impacted spec sections in the PR description

## Development

```sh
deno task check   # fmt + lint + test
```

## Repository layout

```
spec/       Protocol specification documents
src/        Reference implementation (Deno/TypeScript)
```
