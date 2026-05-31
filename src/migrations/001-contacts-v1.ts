import { upcastContact } from "../models/mod.ts";
import type { Migration, MigrationContext, MigrationResult } from "./types.ts";

const CONTACT_PREFIX: Deno.KvKey = ["contacts"];
const CONTACT_BY_OID_PREFIX: Deno.KvKey = ["contacts_by_oid"];
const CONTACT_BY_DOMAIN_KEY_PREFIX: Deno.KvKey = ["contacts_by_domain_key"];
const CONTACT_BY_LOCAL_CRED_PREFIX: Deno.KvKey = ["contacts_by_local_cred"];

const CHECKPOINT_EVERY = 100;

interface ContactRoute {
  owner_oid: string;
  contact_id: string;
}

/**
 * Backfill: upgrade every v0 contact record to v1. v0 records used `domain` /
 * `domain_id` and stored no terms or credentials. v1 records use
 * `remote_domain` / `remote_domain_id` and carry placeholder credentials;
 * upgraded records are marked `blocked: true` because the original credential
 * material is lost and the owner must re-invite to restore real messaging.
 *
 * The migration also rebuilds the `contacts_by_domain_key` and
 * `contacts_by_local_cred` secondary indexes which v0 didn't populate.
 */
export const contactsV1Migration: Migration = {
  id: "001-contacts-v1",
  description: "upcast v0 contact records to v1 and rebuild secondary indexes",
  async run(ctx: MigrationContext): Promise<MigrationResult> {
    let scanned = 0;
    let upgraded = 0;

    const listOpts: Deno.KvListOptions = { batchSize: 50 };
    if (ctx.resumeCursor) listOpts.cursor = ctx.resumeCursor;

    const iter = ctx.kv.list<unknown>({ prefix: CONTACT_PREFIX }, listOpts);

    for await (const entry of iter) {
      scanned++;
      const result = upcastContact(entry.value);
      if (!result.changed) {
        if (scanned % CHECKPOINT_EVERY === 0) await ctx.saveCursor(iter.cursor);
        continue;
      }

      if (ctx.dryRun) {
        upgraded++;
        continue;
      }

      const contact = result.contact;
      const route: ContactRoute = {
        owner_oid: contact.owner_oid,
        contact_id: contact.id,
      };

      const commit = await ctx.kv.atomic()
        .check(entry)
        .set(
          [...CONTACT_PREFIX, contact.owner_oid, contact.id],
          contact,
        )
        .set(
          [...CONTACT_BY_OID_PREFIX, contact.owner_oid, contact.id],
          contact.id,
        )
        .set(
          [
            ...CONTACT_BY_DOMAIN_KEY_PREFIX,
            contact.owner_oid,
            contact.remote_domain.toLowerCase(),
            contact.remote_domain_id,
          ],
          contact.id,
        )
        .set(
          [
            ...CONTACT_BY_LOCAL_CRED_PREFIX,
            contact.local_credential.contact_id,
          ],
          route,
        )
        .commit();

      if (commit.ok) {
        upgraded++;
      } else {
        ctx.logger.warn(
          `migration 001-contacts-v1: skipped ${contact.id} (concurrent write)`,
        );
      }

      if (scanned % CHECKPOINT_EVERY === 0) await ctx.saveCursor(iter.cursor);
    }

    return { scanned, upgraded };
  },
};
