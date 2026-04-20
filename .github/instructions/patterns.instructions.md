---
description: "Grove API patterns for building the RPP server. Use when: creating controllers, services, context, routes, middleware, or MCP tools for this application."
applyTo: "src/**"
---

# Grove API Patterns

This project is a Grove-based API built on `@justinmchase/grove` (which uses
`@hono/hono` internally). Follow these patterns for consistency with the
framework and with established Grove applications.

## Entry Point

The entry point is `main.ts` which imports `src/mod.ts`. The mod file creates a
`Grove` instance, initializes context, and starts the application:

```ts
import { ConsoleLogger, Grove, WebMode } from "@justinmchase/grove";

async function initContext(): Promise<Context> {
  const logger = new ConsoleLogger();
  const services = await initServices(logger);
  return { logger, services };
}

const grove = new Grove({
  initContext,
  modes: [new WebMode<Context, State>({ initControllers })],
});

await grove.start(Deno.args);
```

## Context Initialization Chain

Context is built in layers. Each layer receives the previous layers as
dependencies:

1. **Services** — external integrations, config, crypto, MCP server instance.
2. **Repositories** — data access (if/when storage is added).
3. **Managers** — business logic wrapping repositories and services.

```ts
async function initContext(): Promise<Context> {
  const logger = new ConsoleLogger();
  const services = await initServices(logger);
  // const repositories = await initRepositories(services);
  // const managers = await initManagers(services, repositories);
  return { logger, services };
}
```

The `Context` interface extends grove's `IContext`:

```ts
import { type IContext } from "@justinmchase/grove";

export interface Context extends IContext {
  services: Services;
  // repositories: Repositories;
  // managers: Managers;
}
```

The `State` interface extends grove's `IState`:

```ts
import { type IState } from "@justinmchase/grove";

export interface State extends IState<Context> {
  // request-scoped state set by middleware
}
```

## Project Structure

```
main.ts                        → imports src/mod.ts
src/
  mod.ts                       → Grove setup, initContext, initControllers
  context.ts                   → Context and State type definitions
  services/
    mod.ts                     → initServices(), Services type
    config/mod.ts              → ConfigService (centralized env access)
  controllers/
    mod.ts                     → initControllers(context, app)
    {name}/mod.ts              → one controller per concern
  models/
    {name}.model.ts            → data shapes and types
  errors/
    {name}.error.ts            → custom error classes
```

## Controllers

Controllers extend grove's `Controller` class and implement the `use` method to
register routes or middleware on the Hono application.

### Route Controllers

Route controllers register routes directly on the `GroveApp` (a Hono instance):

```ts
import { Controller, type GroveApp } from "@justinmchase/grove";
import type { Context, State } from "../context.ts";

export class ExampleController extends Controller {
  constructor(private readonly someService: SomeService) {
    super();
  }

  async use(app: GroveApp<Context, State>): Promise<void> {
    app.post("/rpp/v1/messages", async (ctx) => {
      // handler logic
      return ctx.json({ ok: true, accepted: true }, 202);
    });
  }
}
```

### Middleware Controllers

Middleware controllers call `app.use()` directly. They intercept all requests
and call `next()` to pass through:

```ts
export class AuthMiddleware extends Controller {
  async use(app: GroveApp<Context, State>): Promise<void> {
    app.use(async (ctx, next) => {
      // verify token, set ctx.var.state fields
      await next();
    });
  }
}
```

## Controller Registration Order

Controllers are registered in `initControllers` in a specific order. Order
matters — middleware controllers affect all controllers registered after them:

```ts
async function initControllers(
  context: Context,
  app: GroveApp<Context, State>,
): Promise<void> {
  // 1. Error handler (wraps everything)
  await new ErrorController().use(app);
  // 2. Health check (before auth, publicly accessible)
  await new HealthController().use(app);
  // 3. Logging
  await new LogController().use(app);
  // 4. Public routes (before auth middleware)
  //    - domain identity, public invitations, submit endpoint
  // 5. Auth middleware (MCP OAuth)
  // 6. Authenticated routes (MCP endpoint)
  // 7. 404 fallback (last)
  await new NotFoundController().use(app);
}
```

## Configuration

Centralize all environment variable access in a `ConfigService` using grove's
config utilities:

```ts
import {
  getEnv,
  readOptionalString,
  readRequiredString,
} from "@justinmchase/grove";

export class ConfigService {
  constructor(
    public readonly port: number,
    public readonly hostname: string,
    // ...
  ) {}

  static async create(): Promise<ConfigService> {
    const env = await getEnv();
    return new ConfigService(
      readOptionalInt(env, "PORT") ?? 8000,
      readOptionalString(env, "HOSTNAME") ?? "0.0.0.0",
    );
  }
}
```

Do NOT scatter `Deno.env.get()` calls throughout the codebase.

## Error Handling

Use grove's `ApplicationError` for structured errors. The `ErrorController`
catches these and formats responses as:

```json
{
  "ok": false,
  "status": 403,
  "code": "E_RECEIPT_NOT_FOUND",
  "message": "Receipt id not recognized by this server."
}
```

RPP error codes (e.g., `RECEIPT_NOT_FOUND`) should be prefixed with `E_` per
grove's `ErrorCode` convention (`WithPrefix<"E_">`).

## Success Responses

Return JSON with explicit content type:

```ts
ctx.response.status = 202;
ctx.response.type = "application/json";
ctx.response.body = { ok: true, accepted: true, message_id: "..." };
```

## Services

Services encapsulate external integrations and provide typed interfaces. They
use a static `create` factory pattern:

```ts
export class SomeService {
  private constructor(/* internal state */) {}

  static async create(
    logger: Logger,
    config: ConfigService,
  ): Promise<SomeService> {
    // async initialization
    return new SomeService(/* ... */);
  }
}
```

## Dependency Injection

Dependencies flow through constructor injection:

- **Services** receive `logger` and `config`.
- **Repositories** receive services (e.g., a database service).
- **Managers** receive services and repositories.
- **Controllers** receive managers and/or services they need.

No DI container — manual wiring in `initContext` and `initControllers`.

## MCP Integration

The MCP endpoint uses `@modelcontextprotocol/sdk` with Streamable HTTP
transport. The MCP server is created as a service and mounted as an Oak route:

- Create an `McpServer` instance in the services layer.
- Register RPP tools (messaging, receipts, invitations, groups, etc.) on the MCP
  server.
- Mount the Streamable HTTP transport handler at the `/mcp` path via a
  controller.
- MCP requests require OAuth 2.1 bearer token authentication (handled by auth
  middleware registered before the MCP controller).

## Crypto

- **HMAC-SHA-256** for receipt signature verification — use grove's built-in
  `hmacCreateKey`, `hmacSign`, `hmacVerify` utilities or Web Crypto API.
- **Ed25519** for domain verification attestations — use Deno's built-in
  `crypto.subtle` API.
- **UUIDv7** for message IDs — use `@std` or Web Crypto.

## Testing

- Unit tests (`*.test.ts`) live next to the module they test.
- Requirement tests (`*.requirement.test.ts`) live in `src/requirements/`.
- Controllers can be tested by creating a mock context and calling the handler.
- Services should be testable in isolation with mock dependencies.
