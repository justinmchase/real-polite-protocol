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

## Quality bar

- Use `deno fmt`, `deno lint`, and `deno test` as the default validation path.
- Add or update tests for behavior changes when practical.
- Validate request input and return stable JSON error shapes for API endpoints.
- Prefer straightforward code paths over clever abstractions.

## Copilot guidance

- When scaffolding handlers or routes, keep Deno Deploy compatibility in mind.
- When suggesting dependencies, prefer JSR packages first, then npm packages
  only when justified.
- When the user asks to add, import, or update a module, use the
  `deno-add-module` skill.
- When editing CI, keep the workflow fast and deterministic.
