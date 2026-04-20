import { AccountManager } from "./account/mod.ts";
import type { Repositories } from "../repositories/mod.ts";

export * from "./account/mod.ts";

export interface Managers {
  accounts: AccountManager;
}

export async function initManagers(repositories: Repositories): Promise<Managers> {
  const accounts = new AccountManager(repositories.accounts);
  return { accounts };
}
