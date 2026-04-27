---
name: get-rpp-token
description: "Acquire a bearer token for the RPP API. Use when: writing scripts or tools that call the RPP server, adding authentication to a new client script, or fetching a token for manual testing. Prefers RPP_TOKEN env var; falls back to `az account get-access-token` against the RPP Azure AD app. Throws a clear error if az CLI is not installed or not logged in."
argument-hint: "Optional scope override (default: api://03c7765e-c8c3-462f-a155-d863f44ea1ed/.default)"
---

# get-rpp-token

Provides a reusable `getToken()` helper that resolves a bearer token for the RPP
API. It prefers an explicit `RPP_TOKEN` env var (useful for non-Azure
deployments or CI), and falls back to the `az` CLI for interactive developer
use.

## When to Use

- Adding authentication to any new client-side script that calls the RPP server
- Testing RPP endpoints manually from the terminal
- Building tooling that runs locally against a remote Deno Deploy instance

## Contract

```ts
// Returns a valid bearer token string, or exits the process with a clear
// error message if authentication cannot be established.
const token: string = await getToken();
```

## Procedure

1. Copy or import [the helper](./scripts/get-token.ts) into your script.
2. Call `await getToken()` — the result is the raw token string.
3. Pass the token as `Authorization: Bearer <token>` on every request.

## Environment Variables

| Variable       | Description                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `RPP_TOKEN`    | Explicit bearer token. If set, skips `az` entirely.                                             |
| `RPP_AZ_SCOPE` | Override the Azure AD scope. Defaults to `api://03c7765e-c8c3-462f-a155-d863f44ea1ed/.default`. |

## Error Cases

| Condition                     | Message                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `az` not on PATH              | `az CLI not found. Install the Azure CLI or set RPP_TOKEN.` |
| Not logged in / token expired | `az account get-access-token failed … Try: az login`        |
| Empty token returned          | `az returned an empty token.`                               |

## Helper Source

See [scripts/get-token.ts](./scripts/get-token.ts).
