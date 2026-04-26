import { generate as generateUUIDv7 } from "@std/uuid/v7";
import { z } from "zod";

export const AccountSchema = z.object({
  id: z.string(),
  oid: z.string(),
  domain_id: z.string(),
  display_name: z.string().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Account = z.infer<typeof AccountSchema>;

export function newAccount(oid: string, now = new Date()): Account {
  return {
    id: generateUUIDv7(),
    oid,
    domain_id: generateUUIDv7(),
    created_at: now,
    updated_at: now,
  };
}

export const UserVerifiedMetadataRecordSchema = z.object({
  oid: z.string(),
  immutable_fields: z.record(z.string(), z.string()),
  user_verified_fields: z.record(z.string(), z.string()),
  admin_verified_fields: z.record(z.string(), z.string()),
  verified_fields: z.record(z.string(), z.string()),
  user_updated_at: z.coerce.date().optional(),
  admin_updated_at: z.coerce.date().optional(),
  updated_at: z.coerce.date(),
});

export type UserVerifiedMetadataRecord = z.infer<
  typeof UserVerifiedMetadataRecordSchema
>;

export interface VerifiableUser {
  oid: string;
  verified_fields: Record<string, string>;
}
