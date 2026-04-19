import { assertEquals, assertExists } from "@std/assert";
import { start } from "./mod.ts";

Deno.test("start - is exported as a function", () => {
  assertExists(start);
  assertEquals(typeof start, "function");
});
