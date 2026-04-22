export type ReceptiveMode = "all" | "domain_filter" | "closed";

export interface DomainFilterRule {
  action: "allow" | "block";
  pattern: string;
}

export interface DomainFilter {
  rules: DomainFilterRule[];
}

export interface ReceptivePolicy {
  policy_id: string;
  oid: string;
  mode: ReceptiveMode;
  domain_filter?: DomainFilter;
  /** If set, this policy expires at this ISO 8601 timestamp (timed window). */
  receptive_until?: string;
  created_at: string;
}
