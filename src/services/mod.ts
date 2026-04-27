import type { Logger } from "@justinmchase/grove";
import { AuthService } from "./auth/auth.service.ts";
import { ConfigService } from "./config/config.service.ts";
import { EventService } from "./events/event.service.ts";
import { KvService } from "./kv/kv.service.ts";
import { McpService } from "./mcp/mcp.service.ts";

export interface Services {
  config: ConfigService;
  kv: KvService;
  events: EventService;
  mcp: McpService;
  auth: AuthService;
}

export interface ServiceInitOptions {
  kvPath?: string;
  port?: number;
}

export async function initServices(
  logger: Logger,
  options: ServiceInitOptions = {},
): Promise<Services> {
  const config = await ConfigService.create(options.port);
  const kv = await KvService.create(logger, options.kvPath ?? config.kvPath);
  const events = EventService.create(kv);
  const mcp = McpService.create(events, kv);
  const auth = AuthService.create(logger, config);
  return { config, kv, events, mcp, auth };
}
