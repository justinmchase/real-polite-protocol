import type {
  DomainIdentity,
  DomainVerificationKey,
  HistoricalVerificationKey,
  StoredDomainVerificationKey,
} from "../../models/mod.ts";
import type { DomainIdentityRepository } from "../../repositories/mod.ts";
import type { ConfigService } from "../../services/config/config.service.ts";
import type { PaginatedResult, PaginationInput } from "../../utils/mod.ts";

export type DomainIdentityUpdate = Partial<Omit<DomainIdentity, "domain">>;

export interface DeleteHistoricalKeyResult {
  key_id: string;
  deleted: boolean;
}

export class DomainIdentityManager {
  constructor(
    private readonly domainIdentity: DomainIdentityRepository,
    private readonly config: ConfigService,
  ) {}

  async getDomainIdentity(): Promise<DomainIdentity> {
    const stored = await this.domainIdentity.get();
    if (stored) {
      return stored;
    }
    return {
      domain: this.config.domain,
      display_name: this.config.domain,
    };
  }

  async updateDomainIdentity(
    update: DomainIdentityUpdate,
  ): Promise<DomainIdentity> {
    const current = await this.getDomainIdentity();
    const updated: DomainIdentity = {
      ...current,
      ...update,
      domain: current.domain,
    };
    await this.domainIdentity.set(updated);
    return updated;
  }

  async getContactPolicyUrl(): Promise<{ contact_policy_url?: string }> {
    const identity = await this.getDomainIdentity();
    return {
      contact_policy_url: identity.contact_policy_url,
    };
  }

  async setContactPolicyUrl(
    contactPolicyUrl: string,
  ): Promise<{ contact_policy_url?: string }> {
    const identity = await this.updateDomainIdentity({
      contact_policy_url: contactPolicyUrl,
    });
    return {
      contact_policy_url: identity.contact_policy_url,
    };
  }

  async getVerificationKey(): Promise<DomainVerificationKey> {
    const existing = await this.domainIdentity.getActiveVerificationKey();
    if (existing) {
      return {
        key_id: existing.key_id,
        public_key: existing.public_key,
      };
    }

    const generated = await this.generateVerificationKey();
    await this.domainIdentity.setActiveVerificationKey(generated);
    return {
      key_id: generated.key_id,
      public_key: generated.public_key,
    };
  }

  async rotateVerificationKey(): Promise<DomainVerificationKey> {
    const current = await this.domainIdentity.getActiveVerificationKey();
    if (current) {
      const historical: HistoricalVerificationKey = {
        key_id: current.key_id,
        public_key: current.public_key,
        archived_at: new Date().toISOString(),
      };
      await this.domainIdentity.appendHistoricalVerificationKey(historical);
    }

    const newKey = await this.generateVerificationKey();
    await this.domainIdentity.setActiveVerificationKey(newKey);
    return {
      key_id: newKey.key_id,
      public_key: newKey.public_key,
    };
  }

  async listHistoricalVerificationKeys(
    pagination: PaginationInput = {},
  ): Promise<PaginatedResult<HistoricalVerificationKey>> {
    return await this.domainIdentity.listHistoricalVerificationKeysPage(
      pagination,
    );
  }

  async deleteHistoricalVerificationKey(
    keyId: string,
  ): Promise<DeleteHistoricalKeyResult> {
    await this.domainIdentity.deleteHistoricalVerificationKey(keyId);
    return {
      key_id: keyId,
      deleted: true,
    };
  }

  private async generateVerificationKey(): Promise<
    StoredDomainVerificationKey
  > {
    const generated = await crypto.subtle.generateKey(
      {
        name: "Ed25519",
      },
      true,
      ["sign", "verify"],
    );

    if (!("publicKey" in generated) || !("privateKey" in generated)) {
      throw new TypeError("Expected Ed25519 key pair generation result");
    }

    const publicKeySpki = new Uint8Array(
      await crypto.subtle.exportKey("spki", generated.publicKey),
    );
    const privateKeyPkcs8 = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", generated.privateKey),
    );

    return {
      key_id: `key_${crypto.randomUUID()}`,
      public_key: {
        algorithm: "Ed25519",
        key: publicKeySpki.toBase64(),
      },
      private_key: privateKeyPkcs8.toBase64(),
      created_at: new Date().toISOString(),
    };
  }
}
