import {
  type Invitation,
  type InvitationDirection,
  InvitationSchema,
} from "../../models/mod.ts";
import type { EventService } from "../../services/events/event.service.ts";
import type { KvService } from "../../services/kv/kv.service.ts";
import { nextResumeToken } from "../../utils/pagination.ts";

/** Primary store: invitations keyed by `invitation_id`. */
const INVITATION_PREFIX: Deno.KvKey = ["invitations"];
/** Index: list invitations by `(owner_oid, direction, invitation_id)`. */
const INVITATION_BY_OWNER_PREFIX: Deno.KvKey = ["invitations_by_owner"];

export interface ListInvitationsOptions {
  direction?: InvitationDirection;
  pageSize?: number;
  cursor?: string;
}

export interface ListInvitationsResult {
  invitations: Invitation[];
  nextCursor?: string;
}

export class InvitationRepository {
  constructor(
    private readonly kv: KvService,
    private readonly events: EventService,
  ) {}

  async get(invitationId: string): Promise<Invitation | undefined> {
    const entry = await this.kv.store.get<unknown>([
      ...INVITATION_PREFIX,
      invitationId,
    ]);
    return entry.value ? InvitationSchema.parse(entry.value) : undefined;
  }

  async set(invitation: Invitation): Promise<Invitation> {
    await this.kv.store
      .atomic()
      .set([...INVITATION_PREFIX, invitation.invitation_id], invitation)
      .set(
        [
          ...INVITATION_BY_OWNER_PREFIX,
          invitation.owner_oid,
          invitation.direction,
          invitation.invitation_id,
        ],
        invitation.invitation_id,
      )
      .commit();
    if (invitation.direction === "inbound") {
      await this.events.bumpInvitation(invitation.owner_oid);
    }
    return invitation;
  }

  async listByOwner(
    ownerOid: string,
    opts: ListInvitationsOptions = {},
  ): Promise<ListInvitationsResult> {
    const { direction, pageSize = 50, cursor } = opts;
    const prefix = direction
      ? [...INVITATION_BY_OWNER_PREFIX, ownerOid, direction]
      : [...INVITATION_BY_OWNER_PREFIX, ownerOid];

    const listOpts: Deno.KvListOptions = { limit: pageSize, reverse: true };
    if (cursor) listOpts.cursor = cursor;

    const iter = this.kv.store.list<string>({ prefix }, listOpts);
    const invitations: Invitation[] = [];
    for await (const entry of iter) {
      const inv = await this.get(entry.value);
      if (inv) invitations.push(inv);
    }
    return { invitations, nextCursor: nextResumeToken(iter.cursor) };
  }
}
