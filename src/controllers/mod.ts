import {
  ErrorController,
  HealthController,
  IsHtmlController,
  LogController,
  NotFoundController,
  type GroveApp,
} from "@justinmchase/grove";
import type { Context, State } from "../context.ts";
import { SubmitController } from "./submit/mod.ts";

export async function initControllers(
  context: Context,
  app: GroveApp<Context, State>,
): Promise<void> {
  await new ErrorController().use(app);
  await new HealthController().use(app);
  await new IsHtmlController().use(app);
  await new LogController().use(app);
  await new SubmitController(context.services.kv).use(app);
  await new NotFoundController().use(app);
}
