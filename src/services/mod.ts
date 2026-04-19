import type { Logger } from "@justinmchase/grove";
import { ConfigService } from "./config/mod.ts";
import { KvService } from "./kv/mod.ts";

export interface Services {
  config: ConfigService;
  kv: KvService;
}

export async function initServices(logger: Logger): Promise<Services> {
  const config = await ConfigService.create();
  const kv = await KvService.create(logger);
  return { config, kv };
}
