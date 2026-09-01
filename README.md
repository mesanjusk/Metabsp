# MetaBSP

A WhatsApp Business Solution Provider platform built on Meta's official
WhatsApp Business Platform (Cloud API). Businesses connect their own WhatsApp
number through Meta's Embedded Signup, then use a shared inbox, message
templates, broadcasts, automations and a REST API to talk to their customers.

There is no unofficial transport anywhere in this codebase. Every message in
and out goes through the Cloud API.

---

## Repository layout

```
nextjs/          The entire application
  app/           Routes — dashboard pages, the REST API, the Meta webhook
  lib/           Models, services, queues, auth, UI components, design system
  tests/         Vitest suite
  scripts/       Operational scripts (backup, restore drill, seeding)
  server.js      Process entry: HTTP server + Socket.IO
  instrumentation.ts  Process entry: queue workers + schedulers
docs/            Meta Tech Provider, deployment, legal and API documentation
scripts/         Pre-deploy configuration gate
render.yaml      Deployment blueprint
```

One application, one deployment. An earlier revision of this repository
carried three overlapping codebases — an Express API, a Vite single-page app,
and this Next.js app that was mid-migration from both — plus an unrelated
"bulk invite" product sharing the same database. Those are gone; see
`docs/CONSOLIDATION.md` for what moved where.

---

## Architecture

Everything runs in **one persistent Node process**. That is a deliberate
constraint, not an accident of hosting:

| Concern | Where it lives | Why it cannot be serverless |
|---|---|---|
| Dashboard + API | Next.js App Router | — |
| Meta webhook | `app/webhook`, `app/api/whatsapp/webhook` | — |
| Live inbox | Socket.IO, attached in `server.js` | Long-lived connections |
| Message sending | BullMQ worker (`lib/queues/whatsappSendWorker.ts`) | Long-polls Redis |
| Webhook processing | BullMQ worker (`lib/queues/webhookWorker.ts`) | Long-polls Redis |
| Token refresh, invoicing, backups, keep-alive | Schedulers (`lib/services/*`) | Real timers |

`server.js` creates the HTTP server so Socket.IO can attach to it.
`instrumentation.ts` — Next's boot hook — starts the workers and schedulers,
because they need the application's own TypeScript models, which do not exist
yet at the point `server.js` runs.

Run several instances if you need to: the schedulers coordinate through a
Redis leader lock, and the two queue workers are competing consumers.
`RUN_BACKGROUND_JOBS=false` makes an instance serve HTTP only.

### Two things worth knowing before changing them

**The webhook acknowledges Meta before it does any work.** It verifies the
HMAC signature, puts the payload on a durable Redis queue, and returns 200 —
typically in under 20 ms. Meta retries a slow webhook and eventually disables
the subscription, and real processing here means a media download, a
re-upload, and a fan-out to customer endpoints that may be slow. If the queue
itself is unreachable, the payload is processed inline rather than dropped.

**Socket.IO connections are authenticated and room-scoped.** A client presents
the same bearer token the REST API uses and joins a room named for its own
user. Message events are addressed to that room. A message whose owner cannot
be resolved is dropped rather than broadcast.

---

## Running it locally

```bash
docker compose up          # MongoDB, Redis, and the app on :3000
```

Or against your own datastores:

```bash
cd nextjs
cp .env.example .env.local # then fill in MONGO_URI, REDIS_URL, JWT_SECRET,
                           # WHATSAPP_TOKEN_ENCRYPTION_KEY at minimum
npm ci
npm run dev
```

`nextjs/.env.example` documents every variable the application reads.

## Checks

```bash
npm run verify   # typecheck, tests, and a production build
```

Individually, from `nextjs/`: `npm run typecheck`, `npm test`,
`npm run build`, `npm run test:coverage`.

## Deploying

`render.yaml` describes the whole deployment: one web service and one Redis
instance. The build runs `scripts/meta-deploy-check.js` first, which refuses
to deploy when required configuration is missing, insecure, or a placeholder —
then typechecks, tests and builds.

**Read the cutover notes at the top of `render.yaml` before pointing a live
deployment at this.** In particular `WHATSAPP_TOKEN_ENCRYPTION_KEY` must carry
across verbatim: a different key does not error, it silently fails to decrypt
every stored access token and every connected number stops sending.

## Operations

```bash
npm run seed:billing-plans   # default subscription plans (no admin UI for these)
npm run backup:mongo         # needs the mongodump binary
npm run restore:mongo
npm run verify-restore       # confirms a restore is actually usable
npm run loadtest:health
npm run loadtest:webhook
```

---

## Meta Tech Provider status

Deployment configuration is gated and verifiable from this repository. Meta
Business Verification, App Review approval, App Dashboard URLs and domains,
and a real end-to-end onboarding run are external and cannot be asserted by
code.

`docs/meta-tech-provider/READINESS_STATUS.md` separates what this repository
can prove from what a person has to check in Meta's dashboard, and is the
document to read before submitting anything.
