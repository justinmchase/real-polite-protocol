import { getEnv, readOptionalString } from "@justinmchase/grove";

export class ConfigService {
  constructor(
    public readonly domain: string,
  ) {}

  static async create(): Promise<ConfigService> {
    const env = await getEnv();
    return new ConfigService(
      readOptionalString(env, "RPP_DOMAIN") ?? "localhost",
    );
  }
}
