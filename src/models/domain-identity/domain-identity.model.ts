export interface DomainIdentity {
  domain: string;
  display_name: string;
  domain_type?: string;
  parent_domain?: string;
  categories_offered?: string[];
  rpp_since?: string;
  contact_policy_url?: string;
}
