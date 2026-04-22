---
description: "General project conventions for this Deno Deploy repository. Use when: writing any code, adding dependencies, creating tests, scaffolding handlers."
applyTo: "**"
---

# Repository instructions

This repository targets Deno Deploy first.

## Runtime assumptions

- Prefer Deno-native and Web Platform APIs over Node.js APIs.
- Default to ESM TypeScript.
- Keep code compatible with edge-style execution: fast startup, low dependency
  weight, and no reliance on local disk state.
- Do not introduce Node-only packages unless the task explicitly requires them
  and the tradeoff is documented.

## Dependencies

- All third-party imports MUST be mapped in the `imports` field of `deno.json`.
  If a dependency is not already listed, add it to `deno.json` first, then
  import from the mapped bare specifier in code.
- Prefer JSR (`jsr:`) packages first. Use npm packages only when justified.
- Do not use `https://deno.land/` URLs for imports.

## Project conventions

- Place application code under `src/`.
- Prefer small, composable modules over large framework-heavy abstractions.
- Keep HTTP behavior explicit: accept `Request`, return `Response`, and use
  clear status codes.
- Centralize environment access behind a small config module instead of
  scattering `Deno.env.get()` calls.
- Favor platform fetch, URL, crypto, streams, and standard language features
  before adding dependencies.

## Testing

- Test files live next to the module they test and use the `.test.ts` suffix
  matching the primary file name (e.g., `mod.ts` → `mod.test.ts`).
- Requirement tests live in `src/requirements/` and use the
  `.requirement.test.ts` suffix (see requirement-testing instructions).
- **No helper duplication**: if a helper function (e.g. `computeHmac`,
  `submitMessage`) appears in more than one test file, extract it immediately
  into a shared `test-helpers.ts` module co-located with the tests that use it,
  and import from there. Never maintain two copies of the same helper.

## Quality bar

- Use `deno fmt`, `deno lint`, and `deno test` as the default validation path.
- Add or update tests for behavior changes when practical.
- Validate request input and return stable JSON error shapes for API endpoints.
- Prefer straightforward code paths over clever abstractions.

## Schema validation (required)

- Treat all external boundaries as untrusted input and validate with `zod`.
- For controllers: parse request payloads (body, query, params, headers where
  applicable) with a Zod schema before business logic.
- For MCP tools: validate `inputSchema` with Zod and validate/shape output with
  a Zod schema before returning.
- Derive TypeScript types from schemas via `z.infer<typeof Schema>`; do not
  maintain parallel hand-written boundary types.
- Pass only validated/parsed instances to managers/repositories.
- If validation fails, return stable, structured errors (do not continue with
  partial or unchecked data).

## Specification authority and change control

- Treat specification sources with this strict authority order:
  1. RFC/spec (`spec/rpp-spec.md`)
  2. Requirement documents (`.github/requirements/**`)
  3. Requirement tests (`src/requirements/**`)
  4. Implementation code (`src/**`)
- When implementing or modifying tests/code, always consult relevant requirement
  documents first and keep tests/code aligned to those requirements.
- Do not silently reinterpret lower-authority artifacts to contradict higher
  authority sources.
- If the user asks for behavior that conflicts with existing requirements,
  request clarification before changing requirements, tests, or code.
- Only change RFC/spec or requirement documents when the user explicitly directs
  those changes.

## Requirement gap analysis

- In planning or review-oriented tasks, perform a requirement gap analysis:
  - Coverage check A: do tests adequately cover each existing requirement?
  - Coverage check B: do requirements adequately cover relevant RFC behavior?
- When gaps are found between RFC and requirements, call them out explicitly
  before implementation.
- Provide a simple coverage score and significant gap list in analysis-style
  responses when scope includes requirements/testing/review:
  - Coverage score format: `X/Y requirements covered by tests (Z%)`.
  - Significant gaps: missing requirements, weak requirement language, or
    untested requirement behaviors.
- Never "patch over" requirement gaps only in code/tests; flag the gap and ask
  whether requirements should be updated.

## Copilot guidance

- When scaffolding handlers or routes, keep Deno Deploy compatibility in mind.
- When suggesting dependencies, prefer JSR packages first, then npm packages
  only when justified.
- When the user asks to add, import, or update a module, use the
  `deno-add-module` skill.
- When editing CI, keep the workflow fast and deterministic.
