import type { Logger } from "@justinmchase/grove";
import type { ConfigService } from "../config/mod.ts";
import type { AuthInfo } from "../../context.ts";

interface JwtHeader {
  alg: string;
  kid?: string;
}

interface JwtPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  scope?: string;
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
    );
  }

  getApiAppClientId(): string {
    return this.azureApiAppClientId;
  }

  async validateBearerToken(authHeader: string | undefined): Promise<AuthInfo> {
    if (!authHeader) {
      throw new AuthError("Missing Authorization header", 401, "MISSING_HEADER");
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AuthError("Invalid Authorization header format", 401, "INVALID_FORMAT");
    }

    const token = match[1];

    if (!this.issuer || !this.audience) {
      throw new AuthError(
        "Auth not configured on this server",
        500,
        "NOT_CONFIGURED",
      );
    }

    const payload = await this.verifyJwt(token);
    return {
      sub: payload.sub,
      aud: payload.aud,
      scope: payload.scope,
    };
  }

  private async verifyJwt(token: string): Promise<JwtPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthError("Invalid token format", 401, "INVALID_TOKEN_FORMAT");
    }

    const header = JSON.parse(this.decodeBase64Url(parts[0])) as JwtHeader;
    const payload = JSON.parse(this.decodeBase64Url(parts[1])) as JwtPayload;
    const signature = parts[2];

    // Verify payload claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      this.logger.error("Token expiration validation failed", {
        exp: payload.exp,
        now: now,
      });
      throw new AuthError("Token expired", 401, "EXPIRED", {
        exp: payload.exp,
        now: now,
      });
    }

    if (payload.nbf && payload.nbf > now) {
      this.logger.error("Token not-before validation failed", {
        nbf: payload.nbf,
        now: now,
      });
      throw new AuthError("Token not yet valid", 401, "NOT_YET_VALID", {
        nbf: payload.nbf,
        now: now,
      });
    }

    if (!this.isValidIssuer(payload.iss)) {
      this.logger.error("Token issuer validation failed", {
        actual: payload.iss,
        expected: this.issuer,
      });
      throw new AuthError("Invalid issuer", 401, "INVALID_ISSUER", {
        actual: payload.iss,
        expected: this.issuer,
      });
    }

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(this.audience!)) {
      this.logger.error("Token audience validation failed", {
        actual: aud,
        expected: this.audience,
      });
      throw new AuthError("Invalid audience", 401, "INVALID_AUDIENCE", {
        actual: aud,
        expected: this.audience,
      });
    }

    // Get JWKS and verify signature
    const jwks = await this.fetchJwks();
    const kid = header.kid;
    const key = kid ? jwks.get(kid) : jwks.values().next().value;

    if (!key) {
      throw new AuthError("Key not found", 401, "KEY_NOT_FOUND");
    }

    await this.verifySignature(token, signature, key, header.alg);

    return payload;
  }

  private async fetchJwks(): Promise<Map<string, Jwk>> {
    const now = Date.now();
    if (this.jwksCache.keys.size > 0 && this.jwksCache.expiresAt > now) {
      return this.jwksCache.keys;
    }

    const jwksUrl = this.azureTenantId
      ? `https://login.microsoftonline.com/${this.azureTenantId}/discovery/v2.0/keys`
      : `${this.issuer}.well-known/jwks.json`;
    const res = await fetch(jwksUrl);
    if (!res.ok) {
      throw new AuthError(`Failed to fetch JWKS: ${res.status}`, 500, "JWKS_FETCH_FAILED");
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

  private async verifySignature(
    token: string,
    signature: string,
    key: Jwk,
    alg: string,
  ): Promise<void> {
    if (alg !== "RS256") {
      throw new AuthError(`Unsupported algorithm: ${alg}`, 400, "UNSUPPORTED_ALGORITHM");
    }

    if (key.kty !== "RSA" || !key.n || !key.e) {
      this.logger.error("JWKS key format validation failed", {
        kty: key.kty,
        hasN: Boolean(key.n),
        hasE: Boolean(key.e),
      });
      throw new AuthError("Invalid key format", 400, "INVALID_KEY_FORMAT", {
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
        throw new AuthError("Invalid signature", 401, "INVALID_SIGNATURE");
      }
    } catch (e) {
      if (e instanceof AuthError) throw e;
      this.logger.error("Signature verification error", { error: String(e) });
      throw new AuthError(`Signature verification failed: ${String(e)}`, 401, "SIGNATURE_VERIFICATION_FAILED");
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

  private isValidIssuer(actual: string | undefined): boolean {
    if (!actual || !this.issuer) return false;

    // Extract tenant ID from both issuers (works for both v1.0 and v2.0)
    // v1.0: https://sts.windows.net/{tenant}/
    // v2.0: https://login.microsoftonline.com/{tenant}/v2.0
    const actualMatch = actual.match(/https:\/\/(?:sts\.windows\.net|login\.microsoftonline\.com)\/([a-f0-9-]+)/i);
    const expectedMatch = this.issuer.match(/https:\/\/(?:sts\.windows\.net|login\.microsoftonline\.com)\/([a-f0-9-]+)/i);

    if (!actualMatch || !expectedMatch) {
      return false;
    }

    // Compare tenant IDs
    return actualMatch[1].toLowerCase() === expectedMatch[1].toLowerCase();
  }

  private decodeBase64Url(str: string): string {
    const padded = str.padEnd(str.length + (4 - (str.length % 4)) % 4, "=");
    const bytes = Uint8Array.from(
      atob(padded.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  }

  private decodeBase64UrlToBytes(str: string): Uint8Array {
    const padded = str.padEnd(str.length + (4 - (str.length % 4)) % 4, "=");
    return Uint8Array.from(
      atob(padded.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
  }

  private bytesToBase64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
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
