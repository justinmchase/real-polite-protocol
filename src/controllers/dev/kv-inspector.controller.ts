import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";
import { z } from "zod";
import type { KvService } from "../../services/kv/kv.service.ts";

const MAX_LIST_LIMIT = 200;
const MAX_FILTER_SCAN = 5000;

const PrefixSchema = z.array(z.union([z.string(), z.number(), z.boolean()]));

const ListQuerySchema = z.object({
  prefix: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIST_LIMIT).default(50),
  q: z.string().optional(),
  reverse: z.coerce.boolean().optional(),
});

function parsePrefix(raw: string | undefined): Deno.KvKey {
  if (!raw) return [];
  const parsed = PrefixSchema.parse(JSON.parse(raw));
  return parsed as Deno.KvKey;
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __type: "Uint8Array", length: value.byteLength };
  }
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(serializeValue);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
  return out;
}

export class KvInspectorController extends Controller {
  constructor(private readonly kv: KvService) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    // Aggregate counts grouped by the first key segment.
    app.get("/_dev/kv/prefixes", async (ctx) => {
      const counts = new Map<string, number>();
      let total = 0;
      for await (const entry of this.kv.store.list({ prefix: [] })) {
        const head = entry.key[0];
        const label = typeof head === "string" ? head : String(head);
        counts.set(label, (counts.get(label) ?? 0) + 1);
        total++;
      }
      const prefixes = [...counts.entries()]
        .map(([prefix, count]) => ({ prefix, count }))
        .sort((a, b) => a.prefix.localeCompare(b.prefix));
      return ctx.json({ total, prefixes });
    });

    // List entries under a prefix with cursor pagination and optional q filter.
    app.get("/_dev/kv/list", async (ctx) => {
      const parsed = ListQuerySchema.safeParse({
        prefix: ctx.req.query("prefix"),
        cursor: ctx.req.query("cursor"),
        limit: ctx.req.query("limit"),
        q: ctx.req.query("q"),
        reverse: ctx.req.query("reverse"),
      });
      if (!parsed.success) {
        return ctx.json(
          { error: "invalid_query", issues: parsed.error.issues },
          400,
        );
      }
      const { cursor, limit, q, reverse } = parsed.data;

      let prefix: Deno.KvKey;
      try {
        prefix = parsePrefix(parsed.data.prefix);
      } catch (_err) {
        return ctx.json({ error: "invalid_prefix" }, 400);
      }

      const opts: Deno.KvListOptions = { batchSize: Math.min(limit, 100) };
      if (cursor) opts.cursor = cursor;
      if (reverse) opts.reverse = true;

      const iter = this.kv.store.list({ prefix }, opts);
      const entries: { key: Deno.KvKey; value: unknown }[] = [];
      const needle = q?.toLowerCase();
      let scanned = 0;

      for await (const entry of iter) {
        scanned++;
        if (needle) {
          const haystack = JSON.stringify(entry.key).toLowerCase() +
            "\u0000" +
            JSON.stringify(serializeValue(entry.value)).toLowerCase();
          if (!haystack.includes(needle)) {
            if (scanned >= MAX_FILTER_SCAN) break;
            continue;
          }
        }
        entries.push({
          key: entry.key as Deno.KvKey,
          value: serializeValue(entry.value),
        });
        if (entries.length >= limit) break;
      }

      return ctx.json({
        entries,
        cursor: iter.cursor || null,
        scanned,
        truncated: needle ? scanned >= MAX_FILTER_SCAN : false,
      });
    });
  }
}
