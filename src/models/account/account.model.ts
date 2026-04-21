export interface Account {
  id: string;
  oid: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

export function newAccount(oid: string, now = new Date()): Account {
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    oid,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export interface UserVerifiedMetadataRecord {
  oid: string;
  user_verified_fields: Record<string, string>;
  admin_verified_fields: Record<string, string>;
  verified_fields: Record<string, string>;
  user_updated_at?: string;
  admin_updated_at?: string;
  updated_at: string;
}

export interface VerifiableUser {
  oid: string;
  verified_fields: Record<string, string>;
}
