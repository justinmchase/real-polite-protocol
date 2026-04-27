import type { KvService } from "../kv/kv.service.ts";

const EVENTS_PREFIX: Deno.KvKey = ["events"];

export type EventKind = "messages" | "invitations";

function eventKey(kind: EventKind, oid: string): Deno.KvKey {
  return [...EVENTS_PREFIX, kind, oid];
}

/**
 * Tracks per-oid notification "ticks" using KV counters.
 *
 * Repositories call `bump*` after writing user-visible data; long-lived
 * subscribers (e.g. an MCP session) iterate `watch(oid)` to receive a kind
 * tag whenever any of that user's tracked event keys advance.
 *
 * Implementation: each kind/oid pair is a `Deno.KvU64` counter incremented
 * via `atomic().sum(...)`. `Deno.Kv.watch` polls KV and yields entries
 * whenever their versionstamp changes, which is exactly the semantics we
 * need for "something happened" notifications.
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

  /**
   * Yields one tag per change to either of the oid's event keys.
   *
   * The first KV watch payload is the current snapshot — it is consumed to
   * establish a baseline and not yielded. Subsequent payloads compare
   * versionstamps and yield only the kinds that actually changed.
   *
   * Cancel by aborting the provided signal; the underlying stream is
   * cancelled in the `finally` block.
   */
  async *watch(
    oid: string,
    signal?: AbortSignal,
  ): AsyncIterable<EventKind> {
    const msgKey = eventKey("messages", oid);
    const invKey = eventKey("invitations", oid);
    const stream = this.kv.store.watch([msgKey, invKey]);

    const onAbort = () => {
      stream.cancel().catch(() => {});
    };
    if (signal) {
      if (signal.aborted) {
        await stream.cancel().catch(() => {});
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    let lastMsgVs: string | null = null;
    let lastInvVs: string | null = null;
    let firstTick = true;

    console.log(`[EventService] watch started oid=${oid}`);
    try {
      for await (const entries of stream) {
        if (signal?.aborted) return;
        const [msg, inv] = entries;
        if (firstTick) {
          lastMsgVs = msg.versionstamp;
          lastInvVs = inv.versionstamp;
          firstTick = false;
          console.log(`[EventService] watch baseline oid=${oid} msgVs=${lastMsgVs} invVs=${lastInvVs}`);
          continue;
        }
        if (msg.versionstamp !== lastMsgVs) {
          lastMsgVs = msg.versionstamp;
          console.log(`[EventService] tick messages oid=${oid}`);
          yield "messages";
        }
        if (inv.versionstamp !== lastInvVs) {
          lastInvVs = inv.versionstamp;
          console.log(`[EventService] tick invitations oid=${oid}`);
          yield "invitations";
        }
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }
}
