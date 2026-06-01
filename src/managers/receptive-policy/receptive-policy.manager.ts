import { generate as generateUUIDv7 } from "@std/uuid/v7";
import { ApplicationError } from "@justinmchase/grove";
import type {
  ContactPolicyEntry,
  DomainFilter,
  ReceptiveMode,
  ReceptivePolicy,
} from "../../models/mod.ts";
import type { ReceptivePolicyRepository } from "../../repositories/mod.ts";

export class ReceptivePolicyNotFoundError extends ApplicationError {
  constructor(policyId: string) {
    super(
      404,
      "E_RECEPTIVE_POLICY_NOT_FOUND",
      `Receptive policy ${policyId} not found`,
    );
  }
}

export class ReceptivePolicyManager {
  constructor(
    private readonly receptivePolicies: ReceptivePolicyRepository,
  ) {}

  async getPolicies(oid: string): Promise<ReceptivePolicy[]> {
    return await this.receptivePolicies.listByOid(oid);
  }

  async getById(policyId: string): Promise<ReceptivePolicy | undefined> {
    return await this.receptivePolicies.getById(policyId);
  }

  async addPolicy(
    oid: string,
    mode: ReceptiveMode,
    domainFilter?: DomainFilter,
    contacts?: ContactPolicyEntry[],
  ): Promise<ReceptivePolicy> {
    const policy: ReceptivePolicy = {
      policy_id: generateUUIDv7(),
      oid,
      mode,
      ...(mode === "domain_filter" && domainFilter
        ? { domain_filter: domainFilter }
        : {}),
      ...(mode === "contact" && contacts ? { contacts } : {}),
      created_at: new Date(),
    };
    return await this.receptivePolicies.add(policy);
  }

  async openWindow(
    oid: string,
    durationSeconds: number,
    scope: ReceptiveMode = "all",
    windowDomainFilter?: DomainFilter,
  ): Promise<ReceptivePolicy> {
    const receptiveUntil = new Date(Date.now() + durationSeconds * 1000);
    const shortcode = await this.generateShortcode();
    const policy: ReceptivePolicy = {
      policy_id: generateUUIDv7(),
      oid,
      mode: scope,
      ...(scope === "domain_filter" && windowDomainFilter
        ? { domain_filter: windowDomainFilter }
        : {}),
      receptive_until: receptiveUntil,
      shortcode,
      created_at: new Date(),
    };
    return await this.receptivePolicies.add(policy);
  }

  /**
   * Generate a unique 8-character lowercase alphanumeric shortcode. Retries
   * on collision (extremely unlikely for short-lived windows).
   */
  private async generateShortcode(maxAttempts = 10): Promise<string> {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < maxAttempts; i++) {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const shortcode = Array.from(bytes)
        .map((b) => alphabet[b % alphabet.length])
        .join("");
      const exists = await this.receptivePolicies.shortcodeExists(shortcode);
      if (!exists) return shortcode;
    }
    throw new Error("Failed to generate a unique shortcode after max attempts");
  }

  async getByShortcode(
    shortcode: string,
  ): Promise<ReceptivePolicy | undefined> {
    return await this.receptivePolicies.getByShortcode(shortcode);
  }

  /**
   * Remove a receptive policy owned by the given user. Throws
   * `ReceptivePolicyNotFoundError` if the policy does not exist or is owned
   * by a different account.
   */
  async removePolicy(oid: string, policyId: string): Promise<void> {
    const policy = await this.receptivePolicies.getById(policyId);
    if (!policy || policy.oid !== oid) {
      throw new ReceptivePolicyNotFoundError(policyId);
    }
    await this.receptivePolicies.delete(policyId);
  }
}
