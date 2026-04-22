import type { Invitation } from "../../models/mod.ts";
import type { KvService } from "../../services/kv/kv.service.ts";

const INVITATION_PREFIX: Deno.KvKey = ["invitations"];

export class InvitationRepository {
  constructor(private readonly kv: KvService) {}

  async get(invitationId: string): Promise<Invitation | undefined> {
    const key: Deno.KvKey = [...INVITATION_PREFIX, invitationId];
    const entry = await this.kv.store.get<Invitation>(key);
    return entry.value ?? undefined;
  }

  async set(invitation: Invitation): Promise<Invitation> {
    const key: Deno.KvKey = [...INVITATION_PREFIX, invitation.invitation_id];
    await this.kv.store.set(key, invitation);
    return invitation;
  }

  async listByReceiver(oid: string): Promise<Invitation[]> {
    // List all invitations for a receiver by scanning with a prefix
    // This is not efficient for large datasets but works for demonstration
    const results: Invitation[] = [];
    
    for await (const entry of this.kv.store.list({ prefix: INVITATION_PREFIX })) {
      const invitation = entry.value as Invitation;
      if (invitation.receiver_oid === oid) {
        results.push(invitation);
      }
    }
    
    return results;
  }
}
