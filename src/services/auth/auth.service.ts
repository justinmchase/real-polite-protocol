import type { Logger } from "@justinmchase/grove";
import type { ConfigService } from "../config/config.service.ts";
import type { AuthInfo } from "../../context.ts";

interface JwtHeader {
  alg: string;
  kid?: string;
}

interface JwtPayload {
  iss: string;
  sub: string;
  oid?: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  scope?: string;
  scp?: string;
  roles?: string[] | string;
  name?: string;
  email?: string;
  preferred_username?: string;
  ctry?: string;
}

interface Jwk {
  kty: string;
  use?: string;
  kid?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

interface JwksResponse {
  keys: Jwk[];
}

export class AuthService {
  private jwksCache: { keys: Map<string, Jwk>; expiresAt: number } = {
    keys: new Map(),
    expiresAt: 0,
  };

  private constructor(
    private readonly logger: Logger,
    private readonly issuer: string | undefined,
    private readonly audience: string | undefined,
    private readonly azureTenantId: string | undefined,
    private readonly azureApiAppClientId: string,
    private readonly debugLogTokenPayload: boolean,
    private readonly debugLogRawAccessToken: boolean,
  ) {}

  static create(
    logger: Logger,
    config: ConfigService,
  ): AuthService {
    const issuer = config.issuer ??
      `https://login.microsoftonline.com/${config.azureTenantId}/v2.0`;
    const audience = config.audience ?? `api://${config.azureApiAppClientId}`;
    return new AuthService(
      logger,
      issuer,
      audience,
      config.azureTenantId,
      config.azureApiAppClientId,
      config.authDebugLogTokenPayload,
      config.authDebugLogRawAccessToken,
    );
  }

  getApiAppClientId(): string {
    return this.azureApiAppClientId;
  }

  getRequiredScopes(): string[] {
    const apiScopePrefix = `api://${this.azureApiAppClientId}`;
    return [
      `${apiScopePrefix}/rpp.tools.read`,
      `${apiScopePrefix}/rpp.messages.submit`,
    ];
  }

  async validateBearerToken(authHeader: string | undefined): Promise<AuthInfo> {
    if (!authHeader) {
      throw new AuthError(
        "Missing Authorization header",
        401,
        "E_MISSING_HEADER",
      );
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AuthError(
        "Invalid Authorization header format",
        401,
        "E_INVALID_FORMAT",
      );
    }

    const token = match[1];

    if (this.debugLogRawAccessToken) {
      this.logger.info("Raw access token", { token });
    }

    if (!this.issuer || !this.audience) {
      throw new AuthError(
        "Auth not configured on this server",
        500,
        "E_NOT_CONFIGURED",
      );
    }

    const payload = await this.verifyJwt(token);
    const resolvedScope = payload.scope ?? payload.scp;
    const resolvedRoles = this.normalizeRoles(payload.roles);
    this.verifyMcpScopes(resolvedScope, resolvedRoles);
    if (!payload.oid || !payload.oid.trim()) {
      throw new AuthError("Missing oid claim", 401, "E_MISSING_OID");
    }

    return {
      sub: payload.sub,
      aud: payload.aud,
      scope: resolvedScope,
      oid: payload.oid,
      roles: resolvedRoles,
      name: payload.name || undefined,
      email: payload.email || undefined,
      preferred_username: payload.preferred_username || undefined,
      ctry: payload.ctry || undefined,
    };
  }

  private normalizeRoles(roles: string[] | string | undefined): string[] {
    if (Array.isArray(roles)) {
      return roles.map((role) => role.trim()).filter(Boolean);
    }

    if (typeof roles === "string") {
      return roles
        .split(/\s+/)
        .map((role) => role.trim())
        .filter(Boolean);
    }

    return [];
  }

  private async verifyJwt(token: string): Promise<JwtPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthError("Invalid token format", 401, "E_INVALID_TOKEN_FORMAT");
    }

    const header = JSON.parse(this.decodeBase64Url(parts[0])) as JwtHeader;
    const payload = JSON.parse(this.decodeBase64Url(parts[1])) as JwtPayload;
    const signature = parts[2];

    if (this.debugLogTokenPayload) {
      this.logger.info("Decoded access token payload", {
        payload,
      });
    }

    // Verify payload claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      this.logger.error("Token expiration validation failed", {
        exp: payload.exp,
        now: now,
      });
      throw new AuthError("Token expired", 401, "E_EXPIRED", {
        exp: payload.exp,
        now: now,
      });
    }

    if (payload.nbf && payload.nbf > now) {
      this.logger.error("Token not-before validation failed", {
        nbf: payload.nbf,
        now: now,
      });
      throw new AuthError("Token not yet valid", 401, "E_NOT_YET_VALID", {
        nbf: payload.nbf,
        now: now,
      });
    }

    if (!this.isValidIssuer(payload.iss)) {
      this.logger.error("Token issuer validation failed", {
        actual: payload.iss,
        expected: this.issuer,
      });
      throw new AuthError("Invalid issuer", 401, "E_INVALID_ISSUER", {
        actual: payload.iss,
        expected: this.issuer,
      });
    }

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!this.isValidAudience(aud)) {
      this.logger.error("Token audience validation failed", {
        actual: aud,
        expected: this.audience,
      });
      throw new AuthError("Invalid audience", 401, "E_INVALID_AUDIENCE", {
        actual: aud,
        expected: this.audience,
      });
    }

    // Get JWKS and verify signature
    const jwks = await this.fetchJwks();
    const kid = header.kid;
    const key = kid ? jwks.get(kid) : jwks.values().next().value;

    if (!key) {
      throw new AuthError("Key not found", 401, "E_KEY_NOT_FOUND");
    }

    await this.verifySignature(token, signature, key, header.alg);

    return payload;
  }

  private async fetchJwks(): Promise<Map<string, Jwk>> {
    const now = Date.now();
    if (this.jwksCache.keys.size > 0 && this.jwksCache.expiresAt > now) {
      return this.jwksCache.keys;
    }

    const jwksUrl = this.resolveJwksUrl();
    const res = await fetch(jwksUrl);
    if (!res.ok) {
      throw new AuthError(
        `Failed to fetch JWKS: ${res.status}`,
        500,
        "E_JWKS_FETCH_FAILED",
      );
    }

    const data = (await res.json()) as JwksResponse;
    const keys = new Map<string, Jwk>();
    for (const key of data.keys) {
      if (key.kid) {
        keys.set(key.kid, key);
      }
    }

    // Cache for 1 hour
    this.jwksCache = {
      keys,
      expiresAt: now + 3600000,
    };

    return keys;
  }

  private verifyMcpScopes(scope: string | undefined, roles: string[]): void {
    const actualScopes = (scope ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const requiredScopes = this.getRequiredScopes();
    const actualNormalized = new Set(
      actualScopes.map((value) => this.normalizeScopeName(value)),
    );
    const requiredNormalized = requiredScopes.map((value) =>
      this.normalizeScopeName(value)
    );

    if (requiredNormalized.some((required) => actualNormalized.has(required))) {
      return;
    }

    this.logger.error("Token scope validation failed", {
      actual: actualScopes,
      actualNormalized: Array.from(actualNormalized),
      roles,
      expectedAnyOf: requiredScopes,
      expectedNormalizedAnyOf: requiredNormalized,
    });
    throw new AuthError("Insufficient scope", 403, "E_INSUFFICIENT_SCOPE", {
      actual: actualScopes,
      actualNormalized: Array.from(actualNormalized),
      roles,
      expectedAnyOf: requiredScopes,
      expectedNormalizedAnyOf: requiredNormalized,
    });
  }

  private normalizeScopeName(scopeValue: string): string {
    const slashIndex = scopeValue.lastIndexOf("/");
    if (slashIndex < 0) {
      return scopeValue;
    }
    return scopeValue.slice(slashIndex + 1);
  }

  private resolveJwksUrl(): string {
    const normalizedIssuer = this.normalizeIssuer(this.issuer);
    const isAzureIssuer =
      /https:\/\/(?:sts\.windows\.net|login\.microsoftonline\.com)\//i
        .test(normalizedIssuer);

    if (this.azureTenantId && isAzureIssuer) {
      return `https://login.microsoftonline.com/${this.azureTenantId}/discovery/v2.0/keys`;
    }

    return new URL(
      ".well-known/jwks.json",
      `${normalizedIssuer}/`,
    ).toString();
  }

  private async verifySignature(
    token: string,
    signature: string,
    key: Jwk,
    alg: string,
  ): Promise<void> {
    if (alg !== "RS256") {
      throw new AuthError(
        `Unsupported algorithm: ${alg}`,
        400,
        "E_UNSUPPORTED_ALGORITHM",
      );
    }

    if (key.kty !== "RSA" || !key.n || !key.e) {
      this.logger.error("JWKS key format validation failed", {
        kty: key.kty,
        hasN: Boolean(key.n),
        hasE: Boolean(key.e),
      });
      throw new AuthError("Invalid key format", 400, "E_INVALID_KEY_FORMAT", {
        kty: key.kty,
        hasN: Boolean(key.n),
        hasE: Boolean(key.e),
      });
    }

    try {
      const cryptoKey = await this.importRsaPublicKey(key.n, key.e);
      const data = new TextEncoder().encode(
        token.substring(0, token.lastIndexOf(".")),
      );
      const sig = new Uint8Array(this.decodeBase64UrlToBytes(signature));

      const isValid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        sig,
        data,
      );

      if (!isValid) {
        this.logger.error("Signature verification failed", {});
        throw new AuthError("Invalid signature", 401, "E_INVALID_SIGNATURE");
      }
    } catch (e) {
      if (e instanceof AuthError) throw e;
      this.logger.error("Signature verification error", { error: String(e) });
      throw new AuthError(
        `Signature verification failed: ${String(e)}`,
        401,
        "E_SIGNATURE_VERIFICATION_FAILED",
      );
    }
  }

  private async importRsaPublicKey(
    n: string,
    e: string,
  ): Promise<CryptoKey> {
    const nBytes = this.decodeBase64UrlToBytes(n);
    const eBytes = this.decodeBase64UrlToBytes(e);

    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: "RSA",
        n: this.bytesToBase64Url(nBytes),
        e: this.bytesToBase64Url(eBytes),
        alg: "RS256",
        ext: true,
      },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }

  private normalizeIssuer(issuer: string | undefined): string {
    return (issuer ?? "").replace(/\/+$/, "");
  }

  private isValidAudience(actual: string[]): boolean {
    if (!this.audience) return false;

    // Accept exact match
    if (actual.includes(this.audience)) return true;

    // Azure v2.0 tokens use bare client ID, v1.0/config may use api:// prefix.
    // Normalize both sides to bare client ID for comparison.
    const normalizeAud = (value: string) => value.replace(/^api:\/\//, "");
    const expectedNormalized = normalizeAud(this.audience);
    return actual.some((a) => normalizeAud(a) === expectedNormalized);
  }

  private isValidIssuer(actual: string | undefined): boolean {
    if (!actual || !this.issuer) return false;

    if (this.normalizeIssuer(actual) === this.normalizeIssuer(this.issuer)) {
      return true;
    }

    // Extract tenant ID from both issuers (works for both v1.0 and v2.0)
    // v1.0: https://sts.windows.net/{tenant}/
    // v2.0: https://login.microsoftonline.com/{tenant}/v2.0
    const actualMatch = actual.match(
      /https:\/\/(?:sts\.windows\.net|login\.microsoftonline\.com)\/([a-f0-9-]+)/i,
    );
    const expectedMatch = this.issuer.match(
      /https:\/\/(?:sts\.windows\.net|login\.microsoftonline\.com)\/([a-f0-9-]+)/i,
    );

    if (!actualMatch || !expectedMatch) {
      return false;
    }

    // Compare tenant IDs
    return actualMatch[1].toLowerCase() === expectedMatch[1].toLowerCase();
  }

  private decodeBase64Url(str: string): string {
    return new TextDecoder().decode(
      Uint8Array.fromBase64(str, { alphabet: "base64url" }),
    );
  }

  private decodeBase64UrlToBytes(str: string): Uint8Array {
    return Uint8Array.fromBase64(str, { alphabet: "base64url" });
  }

  private bytesToBase64Url(bytes: Uint8Array): string {
    return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
  }
}

export class AuthError extends Error {
  public override readonly name = "AuthError";

  constructor(
    public override readonly message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
  }
}
