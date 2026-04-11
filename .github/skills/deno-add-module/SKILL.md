---
name: deno-add-module
description: "Add a new third-party module to the project. Use when: adding a dependency, importing a new package, introducing a new library, updating an existing dependency. Ensures the module is mapped in deno.json before importing in code. Prefers JSR packages over npm."
---

# Add a Deno Module

## When to Use

- Adding a new third-party dependency to the project.
- Importing a package that is not yet listed in `deno.json`.
- Switching an inline URL import to a mapped bare specifier.
- Updating or re-adding a module that already exists in `deno.json`.

## Procedure

1. **Check `deno.json`** — Open `deno.json` and inspect the `imports` field for
   an existing mapping. If the module is already mapped, skip to step 4.

2. **Choose the package** — Prefer JSR (`jsr:`) packages first. Only use npm
   (`npm:`) packages when no suitable JSR alternative exists. Never use
   `https://deno.land/` URLs.

3. **Add the dependency with `deno add`** — Never edit the `imports` section of
   `deno.json` directly. Use the `deno add` command instead. If the user does
   not specify an exact version, assume the latest version.

   ```sh
   deno add jsr:@new/package
   ```

4. **Import from the bare specifier in code** — Use the mapped name, not a raw
   URL:

   ```ts
   import { something } from "@new/package";
   ```

5. **Run `deno test`** — Verify the new dependency resolves and existing tests
   still pass.

## Updating an Existing Module

If the module is already in `deno.json` and the user asks to add it again or
update it:

1. **Check for outdated versions** — Run `deno outdated` to see which
   dependencies have newer versions available.

   ```sh
   deno outdated
   ```

2. **Update the dependency** — Run `deno update` to bring the module (or all
   modules) to the latest compatible version.

   ```sh
   # Update a specific package
   deno update jsr:@new/package

   # Update all packages
   deno update
   ```

3. **Run `deno test`** — Verify everything still works after the update.
