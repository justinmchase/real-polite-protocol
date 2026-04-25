import { assertEquals, assertExists } from "@std/assert";
import { withStartedServer } from "../test-helpers.ts";
import { submitMessage } from "./test-helpers.ts";

Deno.test({
  name: "req:submit-003 - Submit requests are protected against replay",
  fn: async (t) => {
    await withStartedServer(async ({ kvPath, baseUrl }) => {
      const kv = await Deno.openKv(kvPath);
      const receiptId = crypto.randomUUID();
      const receiptSecret = crypto.randomUUID();

      try {
        await kv.set(["receipts", receiptId], {
          id: receiptId,
          secret: receiptSecret,
          status: "active",
        });
      } finally {
        kv.close();
      }

      await t.step(
        "a stale timestamp (> 60 seconds old) is rejected with E_REQUEST_STALE",
        async () => {
          const staleTime = new Date(Date.now() - 90_000).toISOString(); // 90 seconds ago
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: staleTime,
            baseUrl,
          });
          assertEquals(response.status, 400);
          const body = await response.json() as { code?: string };
          assertEquals(body.code, "E_REQUEST_STALE");
        },
      );

      await t.step(
        "a future timestamp (> 60 seconds ahead) is rejected with E_REQUEST_STALE",
        async () => {
          const futureTime = new Date(Date.now() + 90_000).toISOString(); // 90 seconds in future
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId: crypto.randomUUID(),
            timestamp: futureTime,
            baseUrl,
          });
          assertEquals(response.status, 400);
          const body = await response.json() as { code?: string };
          assertEquals(body.code, "E_REQUEST_STALE");
        },
      );

      await t.step(
        "a fresh request is accepted",
        async () => {
          const messageId = crypto.randomUUID();
          const response = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(response.status, 202);
          const body = await response.json() as {
            ok?: boolean;
            accepted?: boolean;
            message_id?: string;
          };
          assertEquals(body.ok, true);
          assertEquals(body.accepted, true);
          assertExists(body.message_id);
        },
      );

      await t.step(
        "replaying the same message_id is rejected with E_DUPLICATE_MESSAGE",
        async () => {
          const messageId = crypto.randomUUID();

          // First submission succeeds.
          const first = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(first.status, 202);
          await first.body?.cancel();

          // Duplicate submission is rejected.
          const second = await submitMessage({
            receiptId,
            receiptSecret,
            messageId,
            baseUrl,
          });
          assertEquals(second.status, 400);
          const body = await second.json() as { code?: string };
          assertEquals(body.code, "E_DUPLICATE_MESSAGE");
        },
      );
    });
  },
});
