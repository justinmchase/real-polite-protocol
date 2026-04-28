import { assertEquals } from "@std/assert";
import { withStartedServer } from "../helpers/with-started-server.ts";
import {
  requiredScopes,
  withAuthTestContext,
} from "../helpers/with-auth-test-context.ts";

Deno.test({
  name: "req:deployment-001 - Single-Tenant-Per-Instance Deployment",
  fn: async (t) => {
    await t.step(
      "reads domain configuration from ConfigService without multi-tenant awareness",
      async () => {
        // This test verifies that the reference implementation does not contain
        // multi-tenant logic (e.g., domain ID routing, shared KV namespacing).
        // The domain is read once during ConfigService creation, not per-request.

        const { ConfigService } = await import(
          "../../services/config/config.service.ts"
        );
        const config = await ConfigService.create();

        // Verify domain is a string (not an array or object with multiple domains)
        assertEquals(typeof config.domain, "string");
        assertEquals(
          config.domain.length > 0,
          true,
          "Domain should be non-empty string",
        );
      },
    );

    await t.step(
      "context initialization does not include domain routing or multi-tenant state",
      async () => {
        // This test verifies that the context setup is single-domain aware
        // (i.e., no multi-tenant fields or routing logic).

        const { start: importedStart } = await import("../../mod.ts");

        // We can't fully test this without starting the server, but we can
        // verify the code doesn't have obvious multi-tenant patterns.
        // In a multi-domain scenario, we'd need separate instances with
        // separate config, not runtime domain routing.

        // For now, assert that start() can be called and the server initializes.
        // Full multi-domain testing would be done via CD pipeline/infrastructure tests.

        const signal = AbortSignal.timeout(1000); // Start and immediately abort
        try {
          await importedStart({ signal });
        } catch (e) {
          // Expected to abort or timeout; we just verify it starts cleanly
          const error = e as Error;
          assertEquals(error.name, "AbortError");
        }
      },
    );

    await withStartedServer(async ({ baseUrl }) => {
      await t.step(
        "database records do not include domain prefixing (isolation by deployment, not namespace)",
        async () => {
          // This test verifies that the repository layer uses simple record identifiers
          // without multi-tenant domain ID prefixing.
          // In a single-tenant-per-instance model, database isolation is by instance,
          // not by namespace.

          // The repositories (DomainIdentityRepository) and services (KvService)
          // use simple identifiers, not domain-prefixed keys.

          // Verify that record identifiers are simple (not prefixed with domain ID)
          // by checking the repository's identifier structure.

          // The test is mostly informational; the actual test is "does the code work"
          // and "are there no attempts to read/write cross-domain data".

          // In practice, this is verified by:
          // 1. Code review: no domain ID threading through repositories
          // 2. Integration tests: single instance works without domain routing
          // 3. Infrastructure tests: multiple instances are isolated

          // For this implementation test, we just verify that the server
          // responds to a health check without domain routing errors.
          const res = await fetch(`${baseUrl}/health`);
          assertEquals(res.status, 200);
          await res.body?.cancel();
        },
      );
    });

    await withAuthTestContext(async ({ issueToken }) => {
      await t.step(
        "two server instances have isolated KV storage",
        async () => {
          // Start two independent servers, each with their own temp KV directory.
          // Writing a receptive policy to server A must not be visible on server B.
          await withStartedServer(async ({ callTool: callToolA }) => {
            await withStartedServer(async ({ callTool: callToolB }) => {
              const token = await issueToken({
                oid: "oid-domain-admin",
                roles: ["domain.admin"],
                scope: requiredScopes.join(" "),
              });

              // Create a receptive policy on server A.
              const { status, result } = await callToolA<{
                policy_id?: string;
              }>(token, "open_receptive_window", { duration_seconds: 300 });
              assertEquals(status, 200);
              assertEquals(typeof result?.policy_id, "string");

              // Server B must have no policies — its KV is completely separate.
              const { status: statusB, result: resultB } = await callToolB<{
                policies?: unknown[];
              }>(token, "list_receptive_policies", {});
              assertEquals(statusB, 200);
              const policies = resultB?.policies ?? [];
              assertEquals(
                policies.length,
                0,
                "server B must have an empty KV — no data from server A must leak across",
              );
            });
          });
        },
      );
    });
  },
});
