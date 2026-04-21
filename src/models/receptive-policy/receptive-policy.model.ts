export type ReceptiveMode = "all" | "domain_filter" | "closed";
export type WindowScope = "all" | "domain_filter";

export interface DomainFilterRule {
  action: "allow" | "block";
  pattern: string;
}

export interface DomainFilter {
  rules: DomainFilterRule[];
}

export interface ReceptivePolicy {
  oid: string;
  mode: ReceptiveMode;
  domain_filter?: DomainFilter;
  receptive_until?: string;
  window_scope?: WindowScope;
  window_domain_filter?: DomainFilter;
  updated_at: string;
}

export function defaultReceptivePolicy(oid: string): ReceptivePolicy {
  return {
    oid,
    mode: "closed",
    updated_at: new Date().toISOString(),
  };
}
