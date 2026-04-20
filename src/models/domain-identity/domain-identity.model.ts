export interface DomainIdentity {
  domain: string;
  display_name: string;
  domain_type?: string;
  parent_domain?: string;
  categories_offered?: string[];
  rpp_since?: string;
  contact_policy_url?: string;
}

export interface DomainVerificationPublicKey {
  algorithm: "Ed25519";
  key: string;
}

export interface DomainVerificationKey {
  key_id: string;
  public_key: DomainVerificationPublicKey;
}

export interface StoredDomainVerificationKey extends DomainVerificationKey {
  private_key: string;
  created_at: string;
}
