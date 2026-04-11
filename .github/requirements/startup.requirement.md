---
id: startup-001
title: Application starts without error
---

# Application Startup

The `start()` function exported from `src/mod.ts` MUST execute without throwing
an error. This is the entry point for the application and all downstream
behavior depends on a clean startup.

## Expected behavior

- Calling `start()` completes successfully.
- No unhandled exceptions are thrown during startup.
