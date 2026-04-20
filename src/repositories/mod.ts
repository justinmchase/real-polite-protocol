import { AccountRepository } from "./account/mod.ts";
import type { Services } from "../services/mod.ts";

export * from "./account/mod.ts";

export interface Repositories {
  accounts: AccountRepository;
}

export async function initRepositories(services: Services): Promise<Repositories> {
  const accounts = new AccountRepository(services.kv);
  return { accounts };
}
