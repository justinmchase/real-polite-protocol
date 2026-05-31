import type { Logger } from "@justinmchase/grove";
import type { Migration, MigrationContext, MigrationResult } from "./types.ts";

const MARKER_PREFIX: Deno.KvKey = ["_migrations"];

interface MarkerValue {
  completed_at: Date;
  scanned: number;
  upgraded: number;
}

export interface RunOptions {
  dryRun?: boolean;
  /** Run only migrations whose id matches one of these. */
  only?: string[];
}

export interface RunReport {
  migration: string;
  status: "skipped" | "completed" | "dry-run";
  scanned: number;
  upgraded: number;
}

export class MigrationRunner {
  constructor(
    private readonly kv: Deno.Kv,
    private readonly logger: Logger,
    private readonly migrations: readonly Migration[],
  ) {}

  async runPending(opts: RunOptions = {}): Promise<RunReport[]> {
    const reports: RunReport[] = [];
    for (const migration of this.migrations) {
      if (opts.only && !opts.only.includes(migration.id)) continue;

      const markerKey: Deno.KvKey = [...MARKER_PREFIX, migration.id];
      const existing = await this.kv.get<MarkerValue>(markerKey);
      if (existing.value && !opts.dryRun) {
        reports.push({
          migration: migration.id,
          status: "skipped",
          scanned: 0,
          upgraded: 0,
        });
        continue;
      }

      this.logger.info(
        `migration ${migration.id}: starting (${migration.description})`,
      );

      const cursorKey: Deno.KvKey = [...MARKER_PREFIX, migration.id, "cursor"];
      const cursorEntry = await this.kv.get<string>(cursorKey);
      const ctx: MigrationContext = {
        kv: this.kv,
        logger: this.logger,
        dryRun: opts.dryRun ?? false,
        resumeCursor: cursorEntry.value ?? undefined,
        saveCursor: async (cursor: string) => {
          if (opts.dryRun) return;
          await this.kv.set(cursorKey, cursor);
        },
      };

      let result: MigrationResult;
      try {
        result = await migration.run(ctx);
      } catch (err) {
        this.logger.error(`migration ${migration.id}: failed`, err);
        throw err;
      }

      if (!opts.dryRun) {
        const marker: MarkerValue = {
          completed_at: new Date(),
          scanned: result.scanned,
          upgraded: result.upgraded,
        };
        await this.kv.atomic()
          .set(markerKey, marker)
          .delete(cursorKey)
          .commit();
      }

      reports.push({
        migration: migration.id,
        status: opts.dryRun ? "dry-run" : "completed",
        scanned: result.scanned,
        upgraded: result.upgraded,
      });

      this.logger.info(
        `migration ${migration.id}: ${
          opts.dryRun ? "dry-run" : "completed"
        } scanned=${result.scanned} upgraded=${result.upgraded}`,
      );
    }
    return reports;
  }
}
