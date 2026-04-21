import {
  getEnv,
  readOptionalBoolean,
  readOptionalString,
} from "@justinmchase/grove";

export class ConfigService {
  constructor(
    public readonly domain: string,
    public readonly kvPath: string,
    public readonly azureTenantId: string,
    public readonly azureApiAppClientId: string,
    public readonly azureClientAppClientId: string,
    public readonly issuer: string | undefined,
    public readonly audience: string | undefined,
    public readonly authDebugLogTokenPayload: boolean,
    public readonly authDebugLogRawAccessToken: boolean,
  ) {}

  static async create(): Promise<ConfigService> {
    const env = await getEnv();
    return new ConfigService(
      readOptionalString(env, "RPP_DOMAIN") ?? "localhost",
      readOptionalString(env, "RPP_KV_PATH") ?? ".data/kv.sqlite3",
      readOptionalString(env, "AZURE_TENANT_ID") ??
        "22dddbf3-6a10-486d-94dc-b3eca6a4d13e",
      readOptionalString(env, "AZURE_API_APP_CLIENT_ID") ??
        "03c7765e-c8c3-462f-a155-d863f44ea1ed",
      readOptionalString(env, "AZURE_CLIENT_APP_CLIENT_ID") ??
        "4464c8c6-8a29-4f23-a2ae-09d8cf068f71",
      readOptionalString(env, "AUTH_ISSUER"),
      readOptionalString(env, "AUTH_AUDIENCE"),
      readOptionalBoolean(env, "AUTH_DEBUG_LOG_TOKEN_PAYLOAD") ?? false,
      readOptionalBoolean(env, "AUTH_DEBUG_LOG_RAW_ACCESS_TOKEN") ?? false,
    );
  }
}
