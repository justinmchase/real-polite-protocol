export type ReceptiveMode =
  | "all"
  | "domain_filter"
  | "contact"
  | "receipt"
  | "closed";

export interface DomainFilterRule {
  action: "allow" | "block";
  pattern: string;
}

export interface DomainFilter {
  rules: DomainFilterRule[];
}

/**
 * One entry in a contact-mode policy's allowlist.
 * Both fields are required — `domain_id` alone is not a unique identifier.
 */
export interface ContactPolicyEntry {
  /** Issuing hostname. Case-insensitive match at validation time. */
  domain: string;
  /** `domain_id` UUID scoped to `domain`. */
  domain_id: string;
}

export interface ReceptivePolicy {
  policy_id: string;
  oid: string;
  mode: ReceptiveMode;
  /** Present when mode is "domain_filter". */
  domain_filter?: DomainFilter;
  /**
   * Present when mode is "contact": list of (domain, domain_id) pairs to accept.
   * Matching is done on the full composite — domain_id alone is insufficient.
   */
  contacts?: ContactPolicyEntry[];
  /** Present when mode is "receipt": the specific receipt this policy covers. */
  receipt_id?: string;
  /** If set, this policy expires at this ISO 8601 timestamp (timed window). */
  receptive_until?: string;
  created_at: string;
}
