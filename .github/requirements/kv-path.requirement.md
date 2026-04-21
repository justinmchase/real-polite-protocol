---
id: config-001
title: Default local KV path is configurable
---

# Configurable Local KV Path

The reference implementation MUST use a configurable local Deno KV database
path for non-test runtime storage.

## Expected behavior

- By default, the configured local KV path is `.data/kv.sqlite3`.
- The default local KV path is exposed through `ConfigService`.
- Setting `RPP_KV_PATH` overrides the default configured local KV path.
- Service initialization uses the configured KV path when no explicit runtime
  `kvPath` override is supplied.
