import type { Logger } from "@justinmchase/grove";
import { AuthService } from "./auth/auth.service.ts";
import { ConfigService } from "./config/config.service.ts";
import { KvService } from "./kv/kv.service.ts";
import { McpService } from "./mcp/mcp.service.ts";

export interface Services {
  config: ConfigService;
  kv: KvService;
  mcp: McpService;
  auth: AuthService;
}

export interface ServiceInitOptions {
  kvPath?: string;
}

export async function initServices(
  logger: Logger,
  options: ServiceInitOptions = {},
): Promise<Services> {
  const config = await ConfigService.create();
  const kv = await KvService.create(logger, options.kvPath);
  const mcp = McpService.create();
  const auth = AuthService.create(logger, config);
  return { config, kv, mcp, auth };
}
