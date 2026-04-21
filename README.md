# RPP — Real Polite Protocol

RPP is a lightweight, open protocol for structured, courteous machine-to-machine
communication.

This repository contains:

- **The spec** — a formal definition of the RPP protocol
- **A reference implementation** — a lightweight implementation of the spec,
  targeting [Deno Deploy](https://deno.com/deploy)

## Status

Early design phase. Spec and implementation are both under active development.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Local Data

When you run the server locally with `deno task start`, the default Deno KV
database is stored at `.data/kv.sqlite3`.

Set `RPP_KV_PATH` to override that path when needed.
