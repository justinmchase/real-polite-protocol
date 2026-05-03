import {
  type PublicInvitation,
  PublicInvitationSchema,
} from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const PREFIX: Deno.KvKey = ["public_invitations"];
const BY_OID_PREFIX: Deno.KvKey = ["public_invitations_by_oid"];

export class PublicInvitationRepository {
  constructor(private readonly kv: KvService) {}

  async get(invitationId: string): Promise<PublicInvitation | undefined> {
    const key: Deno.KvKey = [...PREFIX, invitationId];
    const entry = await this.kv.store.get<unknown>(key);
    return entry.value ? PublicInvitationSchema.parse(entry.value) : undefined;
  }

  async set(invitation: PublicInvitation): Promise<PublicInvitation> {
    const key: Deno.KvKey = [...PREFIX, invitation.invitation_id];
    const indexKey: Deno.KvKey = [
      ...BY_OID_PREFIX,
      invitation.oid,
      invitation.invitation_id,
    ];
    await this.kv.store.set(key, invitation);
    await this.kv.store.set(indexKey, invitation.invitation_id);
    return invitation;
  }

  async listByOid(oid: string): Promise<PublicInvitation[]> {
    const results: PublicInvitation[] = [];
    const indexPrefix: Deno.KvKey = [...BY_OID_PREFIX, oid];
    for await (const entry of this.kv.store.list({ prefix: indexPrefix })) {
      const invitationId = entry.value as string;
      const invitation = await this.get(invitationId);
      if (invitation) {
        results.push(invitation);
      }
    }
    return results;
  }
}
