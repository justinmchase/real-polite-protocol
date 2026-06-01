import type { Migration } from "@justinmchase/grove";
import { wipeAllMigration } from "./000-wipe-all.ts";

/**
 * Ordered list of all migrations. Append-only — never delete or reorder.
 * Each migration is identified by its stable `id`; the runner skips ones
 * whose marker key already exists.
 */
export const MIGRATIONS: readonly Migration[] = [
  wipeAllMigration,
];
