import { z } from "zod";

export const ReceptiveModeSchema = z.enum([
  "all",
  "domain_filter",
  "contact",
  "receipt",
  "closed",
]);
export type ReceptiveMode = z.infer<typeof ReceptiveModeSchema>;

export const DomainFilterRuleSchema = z.object({
  action: z.enum(["allow", "block"]),
  pattern: z.string(),
});
export type DomainFilterRule = z.infer<typeof DomainFilterRuleSchema>;

export const DomainFilterSchema = z.object({
  rules: z.array(DomainFilterRuleSchema),
});
export type DomainFilter = z.infer<typeof DomainFilterSchema>;

/**
 * One entry in a contact-mode policy's allowlist.
 * Both fields are required — `domain_id` alone is not a unique identifier.
 */
export const ContactPolicyEntrySchema = z.object({
  /** Issuing hostname. Case-insensitive match at validation time. */
  domain: z.string(),
  /** `domain_id` UUID scoped to `domain`. */
  domain_id: z.string(),
});
export type ContactPolicyEntry = z.infer<typeof ContactPolicyEntrySchema>;

export const ReceptivePolicySchema = z.object({
  policy_id: z.string(),
  oid: z.string(),
  mode: ReceptiveModeSchema,
  /** Present when mode is "domain_filter". */
  domain_filter: DomainFilterSchema.optional(),
  /**
   * Present when mode is "contact": list of (domain, domain_id) pairs to accept.
   * Matching is done on the full composite — domain_id alone is insufficient.
   */
  contacts: z.array(ContactPolicyEntrySchema).optional(),
  /** Present when mode is "receipt": the specific receipt this policy covers. */
  receipt_id: z.string().optional(),
  /** If set, this policy expires at this timestamp (timed window). */
  receptive_until: z.coerce.date().optional(),
  created_at: z.coerce.date(),
});

export type ReceptivePolicy = z.infer<typeof ReceptivePolicySchema>;
