import type { KvService } from "../kv/kv.service.ts";

const EVENTS_PREFIX: Deno.KvKey = ["events"];

export type EventKind = "messages" | "invitations";

function eventKey(kind: EventKind, oid: string): Deno.KvKey {
  return [...EVENTS_PREFIX, kind, oid];
}

/**
 * Tracks per-oid notification "ticks" using KV counters.
 *
 * Repositories call `bump*` after writing user-visible data to increment
 * the per-kind/oid counter. The counters are available for future use by
 * any notification mechanism that can tolerate serverless constraints
 * (e.g. a polling endpoint backed entirely by KV).
 *
 * Implementation: each kind/oid pair is a `Deno.KvU64` counter incremented
 * via `atomic().sum(...)`.
 */
export class EventService {
  private constructor(private readonly kv: KvService) {}

  static create(kv: KvService): EventService {
    return new EventService(kv);
  }

  async bump(kind: EventKind, oid: string): Promise<void> {
    await this.kv.store
      .atomic()
      .sum(eventKey(kind, oid), 1n)
      .commit();
  }

  bumpMessage(oid: string): Promise<void> {
    return this.bump("messages", oid);
  }

  bumpInvitation(oid: string): Promise<void> {
    return this.bump("invitations", oid);
  }
}
