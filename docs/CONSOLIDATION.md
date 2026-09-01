# Consolidation: three codebases to one

This repository used to contain three overlapping applications and a fourth,
unrelated product. It now contains one. This is the record of what moved
where, so a reference to an old path in an older document can be resolved.

## What was here

| | What it was | Fate |
|---|---|---|
| `backend/src/` | Express API — the WhatsApp Cloud API product | Ported into `nextjs/` |
| `backend/bulk/` | "Bulk invite" — a separate RSVP/invitation product sharing the same database | **Removed** |
| `frontend/` | Vite + React single-page app for the same product | Ported into `nextjs/` |
| `nextjs/` | Partially complete port of both | **The application** |

The Express and Vite halves were not legacy in the sense of being unused —
they were what served production while `nextjs/` was being written. Keeping
all three meant two implementations of the same feature drifting apart, and
`nextjs/STATUS.md` explicitly warned against editing one side without the
other. That is now moot.

## Why the bulk-invite product was removed rather than ported

It was a different product that happened to share a database: RSVP invitation
cards, `wa.me` link generation, campaign blasts with `includeRsvp` and
`rsvpYesLabel` fields. Its send endpoint had already been reduced to a
permanent `501`, because the flow it existed for — free-form messages to an
arbitrary recipient list — is precisely what the Cloud API does not permit.

Its presence was also an active liability during Meta App Review: a reviewer
opening the dashboard found "Meta / Manual / CRM" as the top-level navigation,
where "Manual" meant `wa.me` links and invitation campaigns. That reads as a
bulk-messaging tool wearing a BSP's clothes, which is the exact impression a
Tech Provider submission must not create.

Removed: `backend/bulk/` in full, the `Campaign` model and its API routes, the
`CampaignsPanel` and `ManualInvitePanel` screens, and the `/api/bulk/*` mounts.

`CampaignMessageStatus` is a different thing and stays — it tracks delivery of
Cloud API broadcasts.

## Where the Express modules went

| Was | Is now |
|---|---|
| `backend/src/app.js`, `index.js` | `nextjs/server.js` + `nextjs/instrumentation.ts` |
| `backend/src/routes/externalApi.js` | `nextjs/app/api/v1/*` |
| `backend/src/routes/billing.js` | `nextjs/app/api/billing/*` |
| `backend/src/routes/webhook.js` | `nextjs/app/webhook`, `nextjs/app/api/whatsapp/webhook` |
| `backend/src/controllers/whatsappController.js` | `nextjs/app/api/whatsapp/*` + `nextjs/lib/whatsapp/*` |
| `backend/src/services/*` | `nextjs/lib/services/*` |
| `backend/src/models/*`, `repositories/*` | `nextjs/lib/models/*` |
| `backend/src/queues/*` | `nextjs/lib/queues/*` |
| `backend/src/utils/*` | `nextjs/lib/utils/*` |
| `backend/src/config/graphApi.js` | `nextjs/lib/config/graphApi.ts` |
| `backend/src/config/redis.js`, `mongo.js` | `nextjs/lib/db/redis.ts`, `mongo.ts` |
| `backend/src/middleware/auth.js` | `nextjs/lib/auth/session.ts` |
| `backend/src/middleware/apiKeyAuth.js` | `nextjs/lib/auth/apiKey.ts` |
| `backend/src/middleware/rateLimit.js` | `nextjs/lib/http/rateLimit.ts` |
| `backend/src/middleware/whatsapp24hGuard.js` | `nextjs/lib/whatsapp/twentyFourHourGuard.ts` |
| `helmet()` in `backend/src/app.js` | `nextjs/lib/http/securityHeaders.js` |
| CORS allow-list in `backend/src/app.js` | `nextjs/middleware.ts` |
| `backend/src/socket.js` | `nextjs/lib/socket/server.js` |
| `backend/scripts/*` | `nextjs/scripts/*` |
| `backend/loadtest/*` | `nextjs/loadtest/*` |
| `backend/__tests__/*` | `nextjs/tests/*` (rewritten for Vitest) |

## Where the Vite modules went

| Was | Is now |
|---|---|
| `frontend/src/Components/whatsappCloud/*` | `nextjs/lib/ui/whatsappCloud/*` |
| `frontend/src/components/*` | `nextjs/lib/ui/components/*` |
| `frontend/src/pages/public/*` | `nextjs/app/(public)/*` |
| `frontend/src/Pages/*` | `nextjs/app/(auth)/*`, `nextjs/app/(dashboard)/*` |
| `frontend/src/theme.js` | `nextjs/lib/ui/theme.ts` + `nextjs/lib/ui/tokens.ts` |
| `frontend/src/services/*` | `nextjs/lib/client/services/*` |
| `frontend/src/context/AuthContext.jsx` | `nextjs/lib/ui/AuthContext.jsx` |
| `VITE_*` environment variables | Removed — the app and its API are one origin |

`frontend/src/context/BulkAuthContext.jsx` and the bulk-product pages
(`AdminPage`, `RolesPage`, `UsersPage`, `OnboardingWizardPage`,
`MagicLoginPage`, `NotificationsPage`, `SuperAdminSettingsPage`,
`TechProviderDashboard`, `SecurityDashboardPage`, `DocumentationPage`,
`WhatsAppManagementPage`) were not ported. They belonged to the removed
product or duplicated screens the dashboard already has.

## Route changes

| Old | New |
|---|---|
| `/whatsapp` (the entire dashboard, one page) | `/inbox`, `/contacts`, `/templates`, `/broadcasts`, `/automations`, `/analytics`, `/numbers`, `/developers`, `/settings`, `/admin` |
| `/cloud-signup` | `/signup` |
| `/cloud-forgot-password` | `/forgot-password` |
| `/api/bulk/*` | Removed |
| `/api/v1/send-image` | `/api/v1/send-media` (with a `type`) |

Every old path above still resolves — they are permanent redirects in
`nextjs/next.config.js`, so bookmarks, support articles and App Review testing
instructions that name them keep working.

## Documents that predate this

`docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md`, `docs/AUDIT_REPORT.md`,
`docs/meta-tech-provider/AUDIT_RESPONSE_2026-08-25.md` and
`docs/BAILEYS_REMOVAL.md` are historical records. They describe the repository
as it was at the time they were written and are deliberately not rewritten —
use this table to map any path they mention. Operational documents under
`docs/api/`, `docs/deployment/` and `docs/meta-tech-provider/` still carry
some pre-consolidation paths in their examples; the behaviour they describe is
unchanged.
