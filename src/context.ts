import type { IContext, IState } from "@justinmchase/grove";
import type { Services } from "./services/mod.ts";

export interface AuthInfo {
  sub: string;
  aud: string | string[];
  scope?: string;
}

export interface Context extends IContext {
  services: Services;
}

export interface State extends IState<Context> {
  auth?: AuthInfo;
}
