import { z } from "zod";
import { DomainFilterSchema, ReceiptTermsSchema } from "../mod.ts";

export const PublicInvitationStatusSchema = z.enum([
  "active",
  "cancelled",
  "expired",
]);

export type PublicInvitationStatus = z.infer<typeof PublicInvitationStatusSchema>;

export const PublicInvitationSchema = z.object({
  invitation_id: z.string(),
  /** OID of the listener who created this invitation. */
  oid: z.string(),
  /** RPP domain hosting this invitation. */
  domain: z.string(),
  display_name: z.string().optional(),
  description: z.string().optional(),
  proposed_terms: ReceiptTermsSchema,
  domain_filter: DomainFilterSchema.optional(),
  max_acceptances: z.number().int().positive().optional(),
  /** Running count of acceptances. */
  acceptance_count: z.number().int().min(0).default(0),
  expires_at: z.coerce.date().optional(),
  created_at: z.coerce.date(),
  cancelled_at: z.coerce.date().optional(),
  status: PublicInvitationStatusSchema,
});

export type PublicInvitation = z.infer<typeof PublicInvitationSchema>;
