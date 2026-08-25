# Consolidating onto one Next.js app on Render

The decision: run Next.js on **Render**, not Vercel.

That is what makes "one deployable application" achievable rather than
aspirational. Three things this product needs are impossible on serverless:

| | Why serverless cannot host it |
|---|---|
| Socket.IO (live inbox) | Holds long-lived websocket connections |
| BullMQ broadcast worker | A process that stays up consuming jobs |
| Token-refresh / invoice / backup schedulers | Real timers, not request-scoped |

On Vercel these had to stay on a separate always-on host, which is exactly the
split the consolidation is meant to remove. Render runs a persistent Node
process, so one deployment can hold all of it.

## What makes it one process

`nextjs/server.js`. Started with `node server.js`, not `next start`.

`next start` runs Next's own HTTP server and gives you no handle on it.
Creating the HTTP server yourself and delegating to Next's request handler
leaves the same server available to attach Socket.IO to, and the same process
free to run timers and queue consumers.

```
node server.js
 ├── http.createServer
 │    ├── Socket.IO           ← lib/socket/server.js (attached before listen)
 │    └── Next request handler ← App Router pages + /api route handlers
 └── background jobs           ← worker + schedulers (NOT PORTED YET)
```

Route handlers never reference the Socket.IO instance. They publish through
`lib/socket/emitter.ts`, which writes to the Redis channels the server's
adapter subscribes to. That indirection is what let the app run split across
two hosts, and it keeps working unchanged now that both halves share a
process — which is also why the migration can proceed route by route.

## Verified working

Booted locally against the production build:

```
[socket.io] Server attached
[server] Ready on http://0.0.0.0:3998 (dev=false)

/api/health          -> 503   (correct: no MONGO_URI in the sandbox)
/socket.io handshake -> 200   (websockets live on the same port)
/webhook  (bad token)-> 403   (Meta's verification handshake rejecting correctly)
```

One process, three surfaces. That is the whole architectural claim, and it
holds.

## Migration posture: strangler, not big bang

`metabsp-nextjs` runs **alongside** `metabsp-backend`, sharing one MongoDB,
one Redis and one Meta app. Routes move across one at a time; traffic is cut
over gradually. The Express service is removed only once nothing routes to it.

The alternative — port everything, then flip — means a long stretch where
nothing is verifiable, with a live webhook, two connected WABAs and real
message history riding on it.

## Not done yet

**The schedulers and the BullMQ worker still run on the Express host.**
`RUN_BACKGROUND_JOBS` exists and is plumbed through `server.js`, but nothing
reads it, and it ships as `false`. Two processes racing the same schedules is
how duplicate invoices get generated — the flag flips only when the jobs
actually move, and only on one instance.

**The frontend is not migrated.** ~19,000 lines of Vite/MUI still serve
`meta.instify.in` from Vercel. That is the bulk of the remaining work.

**Four routes are deliberately still on Express**, all in `billing.js`:

| Route | Why it stayed |
|---|---|
| `POST /api/billing/subscribe` | Calls the Cashfree payment gateway |
| `POST /api/billing/webhook` | Cashfree's HMAC check needs the raw request body |
| `GET /api/billing/invoices/:id/pdf` | Needs `invoicePdfService` (not ported) |
| `GET /api/billing/admin/overview` | Needs `adminAnalyticsService` (not ported) |

Payment code is out of scope for this migration by instruction; the read-only
billing routes (`plans`, `subscription`, `invoices`) are ported and the
gateway paths keep running on Express untouched.

**The `bulk/` route set remains on Express** — auth, blast, campaign, crud,
dashboard, org, role, systemSettings, upload, user and whatsapp routers under
`backend/bulk/routes/`.

62 API routes are ported: auth, the whole WhatsApp surface (accounts,
connection, messaging, contacts, templates, automation, campaigns, team,
api-keys, analytics, settings, preflight), webhook destinations, the webhook
itself, and the read-only billing routes.

## Creating the service

`render.yaml` describes `metabsp-nextjs`, but note that the existing
`metabsp-backend` service was created by hand rather than from this blueprint
— its dashboard values win over the file (which is how `WHATSAPP_API_VERSION`
came to resolve to `v18.0` while this file said `v20.0`). Assume the same for
the new service: create it in the dashboard, and treat this file as the record
of what the values should be.

Every `sync: false` variable must match the Express service exactly. Both
halves share one database, one Redis, and one Meta app for the duration.
