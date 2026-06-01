/**
 * One-shot KV migration runner. Usage:
 *
 *   deno task migrate                          # local sqlite (RPP_KV_PATH or default)
 *   deno task migrate --dry-run                # don't write, just report
 *   deno task migrate --only 001-contacts-v1
 *
 * Against the remote Deno Deploy KV for this app, run via the Deploy tunnel:
 *
 *   deno run -A --tunnel scripts/migrate.ts
 *
 * `--tunnel` makes `Deno.openKv()` (with no args) connect to the app's hosted
 * KV instance. Set RPP_KV_PATH to an explicit path/URL only when you need to
 * bypass the tunnel.
 */
import { ConsoleLogger, MigrationRunner } from "@justinmchase/grove";
import { MIGRATIONS } from "../src/migrations/mod.ts";

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
  const kvPath = Deno.env.get("RPP_KV_PATH");
  const logger = new ConsoleLogger();

  logger.info(
    `opening kv at ${kvPath ?? "<default>"}${dryRun ? " (dry-run)" : ""}${
      only.length > 0 ? ` only=${only.join(",")}` : ""
    }`,
  );

  const kv = kvPath ? await Deno.openKv(kvPath) : await Deno.openKv();
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
