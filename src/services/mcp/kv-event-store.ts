import type {
  EventStore,
  StreamId,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { generate as generateUUIDv7 } from "@std/uuid/v7";
import type { KvService } from "../kv/kv.service.ts";

const EVENT_PREFIX: Deno.KvKey = ["mcp_events"];
const EVENT_BY_STREAM_PREFIX: Deno.KvKey = ["mcp_events_by_stream"];

interface StoredEvent {
  event_id: string;
  stream_id: StreamId;
  message: JSONRPCMessage;
  created_at: Date;
}

/**
 * KV-backed `EventStore` for the MCP Streamable HTTP transport.
 *
 * The transport calls `storeEvent(streamId, message)` for each message it
 * sends on an SSE stream. On reconnect with a `Last-Event-ID` header, it
 * calls `replayEventsAfter(eventId, { send })` so the server can re-emit
 * everything sent on that stream after the last seen id, without losing
 * state across brief disconnects (or, when run on Deno Deploy, across
 * isolate recycles — any isolate that picks up the reconnect can replay
 * from KV).
 *
 * Storage layout:
 *   ["mcp_events", eventId]                         → StoredEvent
 *   ["mcp_events_by_stream", streamId, eventId]     → eventId  (index)
 *
 * Event IDs are UUIDv7 so they sort lexicographically by time within a
 * stream, which is what `replayEventsAfter` needs to issue an ordered
 * range scan.
 */
export class KvEventStore implements EventStore {
  constructor(private readonly kv: KvService) {}

  async storeEvent(
    streamId: StreamId,
    message: JSONRPCMessage,
  ): Promise<string> {
    const eventId = generateUUIDv7();
    const record: StoredEvent = {
      event_id: eventId,
      stream_id: streamId,
      message,
      created_at: new Date(),
    };
    await this.kv.store
      .atomic()
      .set([...EVENT_PREFIX, eventId], record)
      .set([...EVENT_BY_STREAM_PREFIX, streamId, eventId], eventId)
      .commit();
    return eventId;
  }

  async getStreamIdForEventId(
    eventId: string,
  ): Promise<StreamId | undefined> {
    const entry = await this.kv.store.get<StoredEvent>([
      ...EVENT_PREFIX,
      eventId,
    ]);
    return entry.value?.stream_id;
  }

  async replayEventsAfter(
    lastEventId: string,
    { send }: {
      send: (eventId: string, message: JSONRPCMessage) => Promise<void>;
    },
  ): Promise<StreamId> {
    const lastEntry = await this.kv.store.get<StoredEvent>([
      ...EVENT_PREFIX,
      lastEventId,
    ]);
    if (!lastEntry.value) {
      // Unknown event id — fall back to a synthetic empty stream so the
      // transport can continue with a fresh slate.
      return "";
    }
    const streamId = lastEntry.value.stream_id;
    const iter = this.kv.store.list<string>({
      start: [...EVENT_BY_STREAM_PREFIX, streamId, lastEventId],
      end: [...EVENT_BY_STREAM_PREFIX, streamId, "\uffff"],
    });
    let first = true;
    for await (const entry of iter) {
      // The start key is inclusive; skip the lastEventId itself.
      if (first) {
        first = false;
        if (entry.value === lastEventId) continue;
      }
      const eventId = entry.value;
      const eventEntry = await this.kv.store.get<StoredEvent>([
        ...EVENT_PREFIX,
        eventId,
      ]);
      if (!eventEntry.value) continue;
      await send(eventId, eventEntry.value.message);
    }
    return streamId;
  }
}
