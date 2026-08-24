---
name: log
description: How to use, configure, and extend `@saas/log` — the provider-agnostic logger backed by Pino with swappable channels and a fake mode for tests.
---

> **Ported from `loyalty-app`, not yet rewritten for the app.** Two things differ:
>
> - **There is no tRPC here.** The typed API is **Hono RPC** (`hc<AppType>`, types only —
>   no runtime RPC, which is the whole reason we picked it over tRPC).
> - **Web and admin call `packages/services` directly**, in Server Components and Server
>   Actions. They never hop through the Hono API. Only mobile goes over HTTP.
>
> Where this file shows a tRPC procedure, read it as a service function. Some packages it
> names do not exist yet — it describes the target, not the current tree. The
> `architecture-guard` skill is the authority.

# `@saas/log`

Single logging abstraction for every app and package in the monorepo.
Pino is the default sink; `console` and `silent` come built-in. You can
register your own transport without touching call sites.

## When to reach for it

- Any time you'd instinctively type `console.log` in product code.
- Background jobs (Trigger), tRPC procedures, server actions, Next route
  handlers, scripts in `packages/*`.
- Tests that need to **assert** on log output.

For one-off debugging in your own branch, `console.log` is fine — just
don't merge it.

## Anatomy

```
LogManager  ─── owns config, caches loggers, exposes `fake()` / `setDefault()`
   │
   ├── Logger ─── has bindings + min level, forwards to a transport
   │
   └── LogTransport ─── concrete sink (Pino, Console, Silent, Fake, ...)
```

The manager is a process-wide **singleton** instantiated in app
bootstrap. Everything else is created lazily.

## Bootstrap

Pick a default channel, register the rest, and export the manager:

```ts
// apps/admin/lib/log.ts
import { LogManager } from "@saas/log";

export const logManager = new LogManager({
  default: process.env.NODE_ENV === "test" ? "silent" : "pino",
  channels: {
    pino: { channel: "pino", options: { level: "info" } },
    console: { channel: "console" },
    silent: { channel: "silent" },
  },
  minLevel: "info",
  baseBindings: { service: "admin", env: process.env.NODE_ENV ?? "dev" },
});

export const log = logManager.logger();
```

Re-export `log` from a single module per app. Don't instantiate `Logger`
directly anywhere else.

## Logging API (Pino-shaped)

```ts
log.trace("entering loop");
log.debug({ orderId }, "found order");
log.info("server ready");
log.warn({ retries: 3 }, "retrying upstream");
log.error(new Error("boom"));                   // err first
log.error(err, "failed to charge");             // err + msg
log.error({ orderId, err }, "failed to charge"); // err in bindings
log.fatal({ exitCode: 1 }, "shutting down");
```

Conventions:

- **First arg is bindings or message.** A string is treated as the message;
  an object is treated as bindings; an `Error` is the captured error.
- **Bindings are flat objects of structured fields**, not human prose. If
  you'd want to query it later, put it in bindings (`{ orderId, userId,
  route }`); if it's only for humans, put it in the message.
- **Always pass errors as `Error` instances** (or in `bindings.err`) so
  the transport can serialize stack traces.

## Request / job scopes — use `child()`

Per-request, per-job, per-tenant context goes in a child:

```ts
// inside a tRPC middleware
const requestLog = log.child({ requestId: ctx.requestId, userId: ctx.userId });
requestLog.info("handling request");
```

`child()` is cheap and pure — the parent is never mutated. Pass
`requestLog` down through the call stack instead of re-bindings at every
site.

## Choosing a channel

```ts
logManager.use("console").info("forced through console");
logManager.use("pino").error(err, "structured pipeline");
logManager.use().info("default channel");        // same as logManager.logger()
```

Switch the default at runtime without recreating the manager:

```ts
logManager.setDefault("console"); // e.g. inside an admin debug action
```

`setMinLevel("debug")` works the same way — both rebuild the cache so
the next `use()` returns a fresh, reconfigured logger.

## Testing

`logManager.fake()` swaps every channel for a `FakeLogger` that captures
records. Always pair with `restore()` in `afterEach`.

```ts
import { afterEach, expect, it } from "vitest";
import { logManager } from "../lib/log";
import { processOrder } from "./order";

afterEach(() => logManager.restore());

it("logs an error when payment is declined", async () => {
  const fake = logManager.fake();

  await processOrder({ failPayment: true });

  fake.assertLogged({ level: "error", msg: /payment declined/ });
  fake.assertLoggedCount({ level: "error" }, 1);
  fake.assertNotLogged({ level: "fatal" });
});
```

Available assertions:

| Method | Purpose |
| --- | --- |
| `assertLogged({ level?, msg?, bindings?, err? })` | A matching record exists |
| `assertNotLogged(criteria)` | No matching record exists |
| `assertLoggedCount(n)` / `assertLoggedCount(criteria, n)` | Count matches |
| `assertNothingLogged()` | Captured array is empty |
| `recordsForLevel(level)` | Inspect raw records for a level |
| `clear()` | Reset captured records mid-test |

`msg` accepts a literal string **or** a `RegExp`. `bindings` is matched
as a subset (extra fields on the record are ignored). `err` takes the
**class**, not an instance — `assertLogged({ err: PaymentError })`.

### Without the manager

For pure unit tests that don't go through the singleton, drop in a
`FakeLogger` directly via `Logger`:

```ts
import { FakeLogger, Logger } from "@saas/log";

const fake = new FakeLogger();
const log = new Logger({
  channel: "test",
  transport: fake,
  minLevel: "trace",
});
```

`@saas/log` also exports `fakeRecord(...)` and `fakeManager(...)`
helpers for writing tests against transports directly. See
[`packages/log/src/factories.ts`](../../../packages/log/src/factories.ts).

## Extending — write a transport

Implement `LogTransport`:

```ts
import type { LogRecord, LogTransport } from "@saas/log";

export class AxiomTransport implements LogTransport {
  readonly name = "axiom";
  readonly #dataset: string;
  readonly #token: string;

  constructor(opts: { dataset: string; token: string }) {
    this.#dataset = opts.dataset;
    this.#token = opts.token;
  }

  async write(record: LogRecord): Promise<void> {
    await fetch(`https://api.axiom.co/v1/datasets/${this.#dataset}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#token}`,
      },
      body: JSON.stringify([
        {
          _time: new Date(record.time).toISOString(),
          level: record.level,
          msg: record.msg,
          ...record.bindings,
          ...(record.err && {
            err: { name: record.err.name, message: record.err.message, stack: record.err.stack },
          }),
        },
      ]),
    });
  }
}
```

Register it on the manager — there are two patterns:

1. **First-class channel**: extend the `ChannelConfig` union in
   `packages/log/src/types.ts`, add a case to `createTransport`, export
   the class. Use this when more than one app needs the channel.
2. **Inline channel**: instantiate it manually in a `LogManager` you
   build inside the consuming app. Useful for app-specific destinations.

Either way, call sites stay the same: `log.info(...)`.

## Conventions

- **One bootstrap module per app.** Do not new up a `LogManager` outside
  it. Tests use the same singleton + `fake()`.
- **`baseBindings` is the place for `service`/`env`.** Anything more
  granular (`requestId`, `userId`) belongs on a `child()`.
- **Never log raw secrets, tokens, full payloads, or PII at info+.**
  Hash, redact, or scope to debug.
- **Don't bypass to `console.log`.** Oxlint warns on it; in product code
  it's a code-review rejection.
- **Errors first.** `log.error(err, "what was happening")` — keeps stacks
  intact and lets transports group by error type.
- **Don't await** logger calls in hot paths. Transports are fire-and-forget.
- **Flush** on graceful shutdown if you use Pino with async destinations:
  `await log.flush()`.

## Common pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unknown log channel "foo"` | Channel not registered | Add it to `LogManager.channels` |
| Pino logs missing in serverless | Worker not flushed | `await log.flush()` before returning |
| Bindings lost across calls | Mutating shared object passed as bindings | Don't — pass plain literals or use `child()` |
| `assertLogged` fails unexpectedly | Captured records reused across tests | Add `logManager.restore()` in `afterEach` |
| Pretty colors in CI | `pretty: true` (default in non-prod) | Set `pretty: false` or `NODE_ENV=production` |

## File layout

```
packages/log/src
├── factories.ts          test helpers (fakeRecord, fakeManager)
├── fake-logger.ts        FakeLogger transport + assertions
├── log-manager.ts        the singleton manager
├── logger.ts             operational Logger handed to call sites
├── errors.ts             LogError, UnknownChannelError, TransportError
├── types.ts              LogLevel, LogRecord, LogTransport, configs
├── transports/
│   ├── pino.ts           default sink
│   ├── console.ts        plain console with optional pretty mode
│   └── silent.ts         no-op sink (default in tests)
└── __tests__/            unit tests (see for usage patterns)
```
