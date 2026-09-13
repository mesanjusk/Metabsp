# Video Studio port

The AI video studio from `mesanjusk/Videos-` now lives in this repository as the **Video** service:
one idea becomes a script, a cast, scene stills, clips, voice-over and a final cut.

This document is about the port itself — what moved, what changed on the way, and what is left.

## Why here

The studio was two deployments that did not fit together: a Next.js app on Vercel, and a worker on
Render that was described in a blueprint and **never actually deployed**. Everything that needed a
persistent process — the queue, the schedulers, browser automation — therefore had nowhere to run.
Jobs enqueued into Redis were drained only by a serverless tick with a 45-second budget, and video
generation, which is worker-only, could not run at all.

This service already is what that worker was missing: one always-on Node process hosting the App
Router, the API, Socket.IO, the BullMQ workers and the schedulers together. The studio's missing
half already existed here.

## What moved, and where

| From (`Videos-`) | To (here) |
| --- | --- |
| `src/core/**` | `nextjs/lib/video/core/**` |
| `src/modules/**` | `nextjs/lib/video/modules/**` |
| `src/components/**` | `nextjs/lib/video/components/**` |
| `src/app/api/**` | `nextjs/app/api/video/**` |
| `src/lib/{utils,workflow-steps}` | `nextjs/lib/video/shared/**` |

Imports were rewritten mechanically (`@/core/…` → `@/lib/video/core/…`, and so on). Relative imports
inside the tree were untouched, because the shape of the tree was preserved.

## The four decisions that made it fit

**Authentication is a one-file swap.** The studio resolved a NextAuth session; this app issues a JWT
held in browser storage and sent as `Authorization: Bearer`. That would normally mean touching all 78
route handlers — except `requireUserId()` already read the header through `headers()` rather than
taking a `Request`, because it was built that way for the Claude Code plugin's MCP server. Only the
verification inside it changed (`nextjs/lib/video/core/auth/session.ts`). Personal API tokens still
work, so anything built against them keeps working.

**One database connection, one Redis connection.** The studio's own connectors were written for
Vercel: `MONGODB_URI`, and a cached connection per warm serverless instance. Both are wrong here, and
the second would have opened a competing pool on an environment variable nobody sets. `core/db/mongoose.ts`
and `core/queue/connection.ts` are now shims that delegate to `lib/db/mongo.ts` and `lib/db/redis.ts`.
`closeRedisConnection` is deliberately a no-op — that connection belongs to the host and outlives any
one queue.

**`strictNullChecks` is on.** The ported code was written under it, and zod's inferred types collapse
every field to optional without it — so validated input stopped matching the functions it fed, in
about a dozen places. Turning it on produced exactly one error in this repository's own code (an
empty array literal inferring `never[]`, which had been hiding unchecked `push` calls). That is a
better trade than a dozen casts, and it is why `tsconfig.json` now sets it.

**The studio's tests came too.** `vitest.config.ts` now includes `lib/video/**/*.test.ts`, so the
suite this deploy gate runs covers the port — 682 tests in total. One of them, the tenancy check that
asserts every collection is scoped by `userId`, failed on arrival because it scanned hardcoded `src/`
paths; it now resolves them from its own location. It was written to catch exactly that.

## What is not done

**The studio's own screens.** `app/(dashboard)/services/video` currently holds one page: the project
list, talking to `/api/video/projects` through `lib/api/client`. The remaining ~68 screens (the
wizard, the scene manager, the queue, the character and background managers) are still in
`lib/video/components` and have not been mounted. They are Tailwind + Radix and were written as
server components that call services directly with a `userId` — which does not work here, because
this app's session lives in the browser. Each becomes a client component fetching from
`/api/video/*`. That is the next stage.

**Video generation.** It drives Google Flow through Playwright, which needs a Chromium that
`node:20-alpine` does not carry. `ENABLE_BROWSER_FALLBACK` is `false` until that is settled — either
a Playwright base image (~500MB, and a browser inside the process serving Meta webhooks) or a
separate worker service sharing this Mongo and Redis. **Images are unaffected**: they are drawn by
the Chrome extension in the operator's own browser and need no Chromium on the server.

## Running it

Set `GEMINI_API_KEY`, `ENCRYPTION_KEY` and `BROWSER_EXTENSION_TOKEN` (see `render.yaml`, which
documents what each does and what breaks without it). Cloudinary and Redis are already configured for
this service and are shared as-is.
