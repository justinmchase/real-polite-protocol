import { assertEquals } from "@std/assert";
import { ConsoleLogger } from "@justinmchase/grove";
import { ConfigService } from "../services/config/config.service.ts";
import { initServices } from "../services/mod.ts";

Deno.test({
  name: "req:config-001 - Default local KV path is configurable",
  fn: async (t) => {
    const originalKvPath = Deno.env.get("RPP_KV_PATH");

    try {
      await t.step(
        "ConfigService defaults local KV storage to .data/kv.sqlite3",
        async () => {
          Deno.env.delete("RPP_KV_PATH");

          const config = await ConfigService.create();

          assertEquals(config.kvPath, ".data/kv.sqlite3");
        },
      );

      await t.step(
        "RPP_KV_PATH overrides the configured local KV path used by services",
        async () => {
          const kvDir = await Deno.makeTempDir({ prefix: "rpp-config-kv-" });
          const kvPath = `${kvDir}/custom.sqlite3`;
          Deno.env.set("RPP_KV_PATH", kvPath);

          const services = await initServices(new ConsoleLogger());
          try {
            const config = await ConfigService.create();

            assertEquals(config.kvPath, kvPath);
            assertEquals(
              await Deno.stat(kvPath).then(() => true).catch(() => false),
              true,
            );
          } finally {
            services.kv.close();
            await Deno.remove(kvDir, { recursive: true });
          }
        },
      );
    } finally {
      if (originalKvPath === undefined) {
        Deno.env.delete("RPP_KV_PATH");
      } else {
        Deno.env.set("RPP_KV_PATH", originalKvPath);
      }
    }
  },
});
