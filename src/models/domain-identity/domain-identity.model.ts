import { z } from "zod";

export const DomainIdentitySchema = z.object({
  domain: z.string(),
  display_name: z.string(),
  domain_type: z.string().optional(),
  parent_domain: z.string().optional(),
  categories_offered: z.array(z.string()).optional(),
  rpp_since: z.string().optional(),
  contact_policy_url: z.string().optional(),
});

export type DomainIdentity = z.infer<typeof DomainIdentitySchema>;

export const DomainVerificationPublicKeySchema = z.object({
  algorithm: z.literal("Ed25519"),
  key: z.string(),
});

export type DomainVerificationPublicKey = z.infer<
  typeof DomainVerificationPublicKeySchema
>;

export const DomainVerificationKeySchema = z.object({
  key_id: z.string(),
  public_key: DomainVerificationPublicKeySchema,
});

export type DomainVerificationKey = z.infer<
  typeof DomainVerificationKeySchema
>;

export const StoredDomainVerificationKeySchema = DomainVerificationKeySchema
  .extend({
    private_key: z.string(),
    created_at: z.coerce.date(),
  });

export type StoredDomainVerificationKey = z.infer<
  typeof StoredDomainVerificationKeySchema
>;

export const HistoricalVerificationKeySchema = DomainVerificationKeySchema
  .extend({
    archived_at: z.coerce.date(),
  });

export type HistoricalVerificationKey = z.infer<
  typeof HistoricalVerificationKeySchema
>;
