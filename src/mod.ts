import { ConsoleLogger, Grove, WebMode } from "@justinmchase/grove";
import type { Context, State } from "./context.ts";
import { initControllers } from "./controllers/mod.ts";
import { initManagers } from "./managers/mod.ts";
import { MigrationRunner, MIGRATIONS } from "./migrations/mod.ts";
import { initRepositories } from "./repositories/mod.ts";
import { initServices } from "./services/mod.ts";
import type { Services } from "./services/mod.ts";
import { initTools } from "./tools/mod.ts";

export interface StartOptions {
  signal?: AbortSignal;
  kvPath?: string;
  port?: number;
}

export async function start(options?: StartOptions): Promise<void> {
  let services: Services | undefined;

  async function initContext(): Promise<Context> {
    const logger = new ConsoleLogger();
    services = await initServices(logger, {
      kvPath: options?.kvPath,
      port: options?.port,
    });
    const repositories = await initRepositories(services);
    const managers = await initManagers(repositories, services);
    const tools = initTools(managers, services.config);

    const runner = new MigrationRunner(services.kv.store, logger, MIGRATIONS);
    runner.runPending().catch((err) => {
      logger.error("kv migrations failed", err);
    });

    return { logger, services, repositories, managers, tools };
  }

  const grove = new Grove({
    initContext,
    modes: [
      new WebMode<Context, State>({ initControllers, port: options?.port }),
    ],
    signal: options?.signal,
  });

  try {
    await grove.start(Deno.args);
  } finally {
    services?.kv.close();
  }
}
