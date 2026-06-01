import type {
  Migration,
  MigrationContext,
  MigrationResult,
} from "@justinmchase/grove";

const MIGRATIONS_MARKER = "_migrations";
const DELETE_BATCH = 100;

/**
 * Wipe all data from every KV prefix except the `_migrations` markers. This
 * is a one-time "start fresh" migration that removes all legacy v0 records
 * that cannot be parsed by the current schemas.
 */
export const wipeAllMigration: Migration = {
  id: "000-wipe-all",
  description: "delete all data except migration markers to clear legacy records",
  async run(ctx: MigrationContext): Promise<MigrationResult> {
    let scanned = 0;
    let upgraded = 0;

    const iter = ctx.kv.list<unknown>({ prefix: [] });

    const batch: Deno.KvKey[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      let atomic = ctx.kv.atomic();
      for (const key of batch) {
        atomic = atomic.delete(key);
      }
      await atomic.commit();
      upgraded += batch.length;
      batch.length = 0;
    };

    for await (const entry of iter) {
      scanned++;

      // Skip migration markers so this migration doesn't re-run.
      if (entry.key[0] === MIGRATIONS_MARKER) continue;

      if (ctx.dryRun) continue;

      batch.push(entry.key);
      if (batch.length >= DELETE_BATCH) await flush();
    }

    if (!ctx.dryRun) await flush();

    return { scanned, upgraded };
  },
};
