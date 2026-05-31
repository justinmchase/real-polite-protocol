import { ConsoleLogger } from "@justinmchase/grove";
import { assertEquals } from "@std/assert";
import { contactsV1Migration } from "./001-contacts-v1.ts";
import { MigrationRunner } from "./runner.ts";

const SILENT_LOGGER = new ConsoleLogger();

function makeV0(id: string, ownerOid: string) {
  return {
    id,
    owner_oid: ownerOid,
    domain: "example.test",
    domain_id: `did-${id}`,
    fields: {},
    created_at: "2026-04-28T01:23:59.292Z",
    updated_at: "2026-04-28T01:24:29.846Z",
  };
}

Deno.test("MigrationRunner: upgrades legacy contacts and skips on rerun", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const owner = "owner-1";
    await kv.set(["contacts", owner, "c1"], makeV0("c1", owner));
    await kv.set(["contacts", owner, "c2"], makeV0("c2", owner));

    const runner = new MigrationRunner(kv, SILENT_LOGGER, [
      contactsV1Migration,
    ]);

    const first = await runner.runPending();
    assertEquals(first[0].status, "completed");
    assertEquals(first[0].scanned, 2);
    assertEquals(first[0].upgraded, 2);

    const c1 = await kv.get<Record<string, unknown>>(["contacts", owner, "c1"]);
    assertEquals(c1.value?.remote_domain, "example.test");
    assertEquals(c1.value?.blocked, true);

    const byDomain = await kv.get<string>([
      "contacts_by_domain_key",
      owner,
      "example.test",
      "did-c1",
    ]);
    assertEquals(byDomain.value, "c1");

    const second = await runner.runPending();
    assertEquals(second[0].status, "skipped");
  } finally {
    kv.close();
  }
});

Deno.test("MigrationRunner: dry-run does not write marker or data", async () => {
  const kv = await Deno.openKv(":memory:");
  try {
    const owner = "owner-2";
    await kv.set(["contacts", owner, "c1"], makeV0("c1", owner));

    const runner = new MigrationRunner(kv, SILENT_LOGGER, [
      contactsV1Migration,
    ]);
    const report = await runner.runPending({ dryRun: true });
    assertEquals(report[0].status, "dry-run");
    assertEquals(report[0].upgraded, 1);

    const c1 = await kv.get<Record<string, unknown>>(["contacts", owner, "c1"]);
    assertEquals(c1.value?.domain, "example.test");

    const marker = await kv.get(["_migrations", contactsV1Migration.id]);
    assertEquals(marker.value, null);
  } finally {
    kv.close();
  }
});
