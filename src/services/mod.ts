import type { Logger } from "@justinmchase/grove";
import { AuthService } from "./auth/mod.ts";
import { ConfigService } from "./config/mod.ts";
import { KvService } from "./kv/mod.ts";
import { McpService } from "./mcp/mod.ts";

export interface Services {
  config: ConfigService;
  kv: KvService;
  mcp: McpService;
  auth: AuthService;
}

export async function initServices(logger: Logger): Promise<Services> {
  const config = await ConfigService.create();
  const kv = await KvService.create(logger);
  const mcp = McpService.create();
  const auth = AuthService.create(logger, config);
  return { config, kv, mcp, auth };
}
