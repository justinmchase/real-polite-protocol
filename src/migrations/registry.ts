import { contactsV1Migration } from "./001-contacts-v1.ts";
import type { Migration } from "./types.ts";

/**
 * Ordered list of all migrations. Append-only — never delete or reorder.
 * Each migration is identified by its stable `id`; the runner skips ones
 * whose marker key already exists.
 */
export const MIGRATIONS: readonly Migration[] = [
  contactsV1Migration,
];
