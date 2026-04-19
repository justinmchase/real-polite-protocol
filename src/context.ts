import type { IContext, IState } from "@justinmchase/grove";
import type { Services } from "./services/mod.ts";

export interface Context extends IContext {
  services: Services;
}

export interface State extends IState<Context> {
  // request-scoped state set by middleware
}
