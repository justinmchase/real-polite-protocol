import type { Logger } from "@justinmchase/grove";

export interface MigrationResult {
  /** Number of records scanned (including ones already at the target version). */
  scanned: number;
  /** Number of records actually rewritten. */
  upgraded: number;
}

export interface MigrationContext {
  kv: Deno.Kv;
  logger: Logger;
  /** When true the migration must not write; report what it would do. */
  dryRun: boolean;
  /**
   * Cursor previously persisted for this migration, or undefined on first run
   * / after completion. Implementations should call `saveCursor` periodically
   * so the migration is resumable across isolate restarts.
   */
  resumeCursor: string | undefined;
  /** Persist a checkpoint cursor so a resumed run skips already-processed keys. */
  saveCursor(cursor: string): Promise<void>;
}

export interface Migration {
  /** Stable identifier used as the marker key. Never change once shipped. */
  readonly id: string;
  readonly description: string;
  run(ctx: MigrationContext): Promise<MigrationResult>;
}
