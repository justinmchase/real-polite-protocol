import type { IContext, IState } from "@justinmchase/grove";
import type { Managers } from "./managers/mod.ts";
import type { Repositories } from "./repositories/mod.ts";
import type { Services } from "./services/mod.ts";
import type { Tool } from "./tools/mod.ts";

export interface AuthInfo {
  sub: string;
  aud: string | string[];
  scope?: string;
  oid: string;
  roles: string[];
}

export interface Context extends IContext {
  services: Services;
  repositories: Repositories;
  managers: Managers;
  tools: Tool[];
}

export interface State extends IState<Context> {
  auth?: AuthInfo;
}
