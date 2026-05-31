/**
 * One-shot KV migration runner. Usage:
 *
 *   deno task migrate                       # local (uses RPP_KV_PATH or default)
 *   deno task migrate --dry-run             # don't write, just report
 *   deno task migrate --only 001-contacts-v1
 *
 * Against a remote Deno Deploy KV database, set:
 *   DENO_KV_ACCESS_TOKEN=<token>
 *   RPP_KV_PATH=https://api.deno.com/databases/<database-id>/connect
 */
import { ConsoleLogger } from "@justinmchase/grove";
import { MigrationRunner, MIGRATIONS } from "../src/migrations/mod.ts";

function parseArgs(args: string[]): { dryRun: boolean; only: string[] } {
  const dryRun = args.includes("--dry-run");
  const only: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && i + 1 < args.length) only.push(args[++i]);
  }
  return { dryRun, only };
}

async function main(): Promise<void> {
  const { dryRun, only } = parseArgs(Deno.args);
  const kvPath = Deno.env.get("RPP_KV_PATH") ?? ".data/kv.sqlite3";
  const logger = new ConsoleLogger();

  logger.info(
    `opening kv at ${kvPath}${dryRun ? " (dry-run)" : ""}${
      only.length > 0 ? ` only=${only.join(",")}` : ""
    }`,
  );

  const kv = await Deno.openKv(kvPath);
  try {
    const runner = new MigrationRunner(kv, logger, MIGRATIONS);
    const reports = await runner.runPending({
      dryRun,
      only: only.length > 0 ? only : undefined,
    });

    console.log("\nMigration report:");
    for (const r of reports) {
      console.log(
        `  ${r.migration.padEnd(28)} ${
          r.status.padEnd(10)
        } scanned=${r.scanned} upgraded=${r.upgraded}`,
      );
    }
  } finally {
    kv.close();
  }
}

if (import.meta.main) {
  await main();
}
