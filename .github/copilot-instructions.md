# Repository instructions

This repository targets Deno Deploy first.

## Runtime assumptions

- Prefer Deno-native and Web Platform APIs over Node.js APIs.
- Default to ESM TypeScript.
- Keep code compatible with edge-style execution: fast startup, low dependency
  weight, and no reliance on local disk state.
- Do not introduce Node-only packages unless the task explicitly requires them
  and the tradeoff is documented.

## Project conventions

- Place application code under `src/`.
- Prefer small, composable modules over large framework-heavy abstractions.
- Keep HTTP behavior explicit: accept `Request`, return `Response`, and use
  clear status codes.
- Centralize environment access behind a small config module instead of
  scattering `Deno.env.get()` calls.
- Favor platform fetch, URL, crypto, streams, and standard language features
  before adding dependencies.

## Quality bar

- Use `deno fmt`, `deno lint`, and `deno test` as the default validation path.
- Add or update tests for behavior changes when practical.
- Validate request input and return stable JSON error shapes for API endpoints.
- Prefer straightforward code paths over clever abstractions.

## Copilot guidance

- When scaffolding handlers or routes, keep Deno Deploy compatibility in mind.
- When suggesting dependencies, prefer JSR packages first, then npm packages
  only when justified.
- When editing CI, keep the workflow fast and deterministic.
