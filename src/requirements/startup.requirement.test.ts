import { assertExists } from "@std/assert";
import { start } from "../mod.ts";

Deno.test("req:startup-001 - Application starts without error", async (t) => {
  await t.step("start() executes without error", () => {
    start();
  });

  await t.step("start is exported from mod", () => {
    assertExists(start);
  });
});
