import {
  getEnv,
  readOptionalBoolean,
  readOptionalString,
} from "@justinmchase/grove";

export class ConfigService {
  /**
   * The computed domain authority (host or host:port) used in outbound
   * envelopes and domain identity.
   *   - localhost always includes the port (e.g. `localhost:8000`)
   *   - Non-localhost on port 443 omits the port (e.g. `example.com`)
   *   - Non-localhost on any other port includes it (e.g. `example.com:8080`)
   */
  public readonly domain: string;

  /**
   * Protocol derived from hostname per the RPP transport security rule:
   * - `localhost` → `http` (development exception)
   * - anything else → `https`
   */
  public readonly protocol: "http" | "https";

  constructor(
    public readonly hostname: string,
    public readonly port: number,
    public readonly kvPath: string,
    public readonly azureTenantId: string,
    public readonly azureApiAppClientId: string,
    public readonly azureClientAppClientId: string,
    public readonly issuer: string | undefined,
    public readonly audience: string | undefined,
    public readonly authDebugLogTokenPayload: boolean,
    public readonly authDebugLogRawAccessToken: boolean,
  ) {
    const isLocalhost = hostname === "localhost";
    this.protocol = isLocalhost ? "http" : "https";
    const isStandardHttps = !isLocalhost && port === 443;
    this.domain = isStandardHttps ? hostname : `${hostname}:${port}`;
  }

  static async create(serverPort?: number): Promise<ConfigService> {
    const env = await getEnv();
    const hostname = readOptionalString(env, "RPP_DOMAIN") ?? "localhost";
    const isLocalhost = hostname === "localhost";
    const defaultPort = isLocalhost ? 8000 : 443;
    const port = serverPort ??
      parseInt(readOptionalString(env, "RPP_PORT") ?? String(defaultPort), 10);
    return new ConfigService(
      hostname,
      port,
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
