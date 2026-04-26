import {
  ErrorController,
  type GroveApp,
  HealthController,
  IsHtmlController,
  LogController,
  NotFoundController,
} from "@justinmchase/grove";
import type { Context, State } from "../context.ts";
import { AuthDiscoveryController } from "./auth-discovery/mod.ts";
import { AuthMiddleware } from "./middleware/auth.middleware.ts";
import { McpController } from "./mcp/mcp.controller.ts";
import { SubmitController } from "./submit/mod.ts";

export async function initControllers(
  context: Context,
  app: GroveApp<Context, State>,
): Promise<void> {
  await new ErrorController().use(app);
  await new HealthController().use(app);
  await new IsHtmlController().use(app);
  await new LogController().use(app);
  await new SubmitController(
    context.services.kv,
    context.managers.invitations,
    context.managers.receptivePolicy,
    context.managers.receipts,
    context.managers.messages,
  ).use(app);
  await new AuthDiscoveryController(context.services.config).use(app);
  await new AuthMiddleware(context.services.auth).use(app);
  await new McpController(
    context.services.mcp,
    context.managers.accounts,
    context.tools,
  ).use(app);
  await new NotFoundController().use(app);
}
