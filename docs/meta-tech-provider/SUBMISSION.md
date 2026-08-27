# App Review submission — the only status document

This replaces `APP_REVIEW.md`, `PRODUCTION_CHECKLIST.md`, `READINESS_STATUS.md`,
`AUDIT_RESPONSE_2026-08-25.md`, `docs/AUDIT_REPORT.md`,
`docs/PRODUCTION_CERTIFICATION_REPORT.md` and `docs/BAILEYS_REMOVAL.md`, all of
which are deleted. They were point-in-time reports that kept being read as
current, and by the end they contradicted each other — one still described a
transport that had been removed, another still called the Graph API version a
blocker after it had been bumped, a third still listed `public_profile` as
required after the submission text had ruled it out. A checklist nobody can
verify decays into fiction.

**The live status is not in this file. Run:**

```
npm run submission-check --workspace=backend
```

against production, with production's environment. It is read-only. It exits
non-zero while any blocker remains and prints exactly what is wrong. This file
explains what it checks and what it cannot.

---

## The deployment, as verified against Render and Vercel (2026-08-27)

| | |
|---|---|
| Public domain | `https://meta.sanjusk.in` — the single source of truth is `frontend/src/config/publicSite.js`, overridable with `VITE_PUBLIC_APP_URL` |
| Frontend | Vercel project `metabsp-frontend`, building `frontend/` (Vite) |
| Backend | Render `MetaBSP` (`srv-d8hok2rtqb8s73aba29g`) → `bulk-invite.onrender.com`, `rootDir: backend`, branch `main` |
| Next.js host | Render `Metabspnext` (`srv-da7578h5efls73c4ssh0`) → `metabspnext.onrender.com`, `rootDir: nextjs` |

Two findings from that pass are worth keeping in view.

**`mis-both.onrender.com` is not a service in this Render account.** The Meta
dashboard's webhook callback URL and Valid OAuth Redirect URI were pointing at
it. The `MIS-Both-` repository deploys as `misbackend-e078.onrender.com` — a
different host, and a different product. Nothing this project runs answers at
`mis-both.onrender.com`, so inbound customer messages, delivery statuses and
the OAuth redirect all went nowhere. Fix both fields in the dashboard before
submitting; the submission check compares the registered callback against
`PUBLIC_APP_URL` and fails if they disagree.

**Both Render services are on the free plan.** The backend's pods carry
`hibernate` in their names and restart every 30–60 minutes. A reviewer who
hits a cold instance waits roughly 50 seconds, or times out. That reads as a
broken app. Upgrade the backend to Starter for the duration of the review.

### Live pre-flight, read from the backend's boot log

Latest boot (2026-08-27 03:29 UTC), after setting `META_ENABLE_COEXISTENCE=false`:

```
[preflight] WhatsApp configuration check — WARN (Graph v23.0, coexistence OFF)
[preflight] embedded_signup_config: Embedded Signup configured (config id 1003501095782121)
[preflight] webhook_fields: All required webhook fields subscribed (messages)
[preflight] coexistence_gating: Coexistence is disabled; the Embedded Signup
            popup will not offer the WhatsApp Business app path
[preflight] token_sources: 0/2 active account(s) using a System User token
```

Graph version and the Embedded Signup config id are confirmed correct against
production. The one open warning is real: **both active accounts run on user
tokens**, which expire and are tied to one person's Meta login. Meta's BSP
guidance wants a Business-owned System User token — see
`SYSTEM_USER_CREATION.md`.

## What the check verifies for you

| Gate | Why it is a gate |
|---|---|
| Required env vars are set and are not placeholders | A value like `your_meta_app_secret` satisfies every `if (!process.env.X)` guard in the codebase and then fails at the Graph call. |
| Webhook signature enforcement is on | Off, anyone who learns the callback URL can inject messages. |
| Webhook fields subscribed at the app level | `messages` plus, when coexistence is on, `history`, `smb_message_echoes`, `smb_app_state_sync`. |
| **The registered callback URL points at this deployment** | Subscribing to fields and registering a callback are independent settings. Every field can be ticked while the callback points at a dead host — this happened, and inbound customer messages went nowhere while every other check passed. |
| Embedded Signup config ID is set | Unset, the dashboard silently falls back to "Connect manually" and the reviewer never sees Embedded Signup. |
| Each active WABA has this app in `subscribed_apps` | An app subscribed to a WABA with the fields unticked still receives nothing. |
| Token source per account | A System User token over one tied to an individual's Meta login. |
| A reviewer account exists and is active | A reviewer cannot self-register: signup requires a WhatsApp OTP. |
| The legal and login URLs return 2xx/3xx | Meta fetches these during review. |

It also prints the exact Meta App Dashboard values, derived from
`PUBLIC_APP_URL`, so there is nothing to transcribe by hand.

## What no code can verify

- **Business Verification.** Meta Business Manager, no read API.
- **Allowed Domains for the JavaScript SDK**, and the OAuth redirect allowlist.
  No read API. Getting the SDK domain wrong produces *"JSSDK unknown host
  domain"* the moment a customer clicks **Connect with Meta** — it blocks
  Embedded Signup, the exact flow under review, not just Facebook login. List
  every host the app is served from, scheme included, no trailing slash.
- **Whether the legal pages are real.** `docs/legal/` ships templates. A 200
  response proves a page exists, not that a lawyer read it.
- **That the reviewer password works.** The check confirms the account exists
  and is active. Sign in yourself, in a private window.
- **That a real message round-trips.** Send one, reply to it.
- **The screen recordings.** One per requested permission —
  `REQUIRED_PERMISSIONS.md` maps them, `docs/videos/` has scripts.

## Permissions

Request exactly three: `whatsapp_business_messaging`,
`whatsapp_business_management`, `business_management`.

**Do not request `public_profile`.** Zero lifetime API calls, and the code
agrees — see `REQUIRED_PERMISSIONS.md`. Requesting a permission the app does
not exercise is a documented rejection trigger.

## Coexistence is off

`META_ENABLE_COEXISTENCE=false` in `render.yaml`, on both services.

The three coexistence webhook fields *are* subscribed in the dashboard, and
pre-flight re-verifies that on every boot. That proves the plumbing exists; it
does not prove the path works, and no coexistence onboarding has been run end
to end. Leaving the flag on would let a reviewer walk into a branch of Embedded
Signup we cannot demonstrate and would then be judged on.

Flip it to `true` after one real onboarding succeeds against a live WhatsApp
Business app number — not before. `COEXISTENCE.md` has the procedure.

## Graph API version

`WHATSAPP_API_VERSION=v23.0` on both services, and the hardcoded fallbacks in
`backend/src/config/graphApi.js` and `nextjs/lib/config/graphApi.ts` match it.

The fallback matters more than the pin. It used to read `v20.0` while
production ran `v23.0`, so any environment that forgot the variable dropped
silently to a pre-Coexistence version. That is not hypothetical: this service
ran on v18.0 for months because the canonical key was unset and the legacy
`META_API_VERSION` alias won.

## Dependencies

`npm audit --omit=dev` reports two moderate advisories, both the same one:
`uuid@8` reached through `exceljs`. The finding is a missing bounds check in
uuid's v3/v5/v6 generators when the caller supplies its own buffer; ExcelJS
calls only `v4`, so it is not reachable. npm's suggested "fix" is a major
downgrade to `exceljs@3`, which is worse in every respect, and an `overrides`
pin to `uuid@11` does not resolve cleanly against the workspace's other
consumer. Accepted, knowingly, and re-evaluate when ExcelJS bumps its range.

This replaced something considerably worse. Spreadsheet import ran on `xlsx`
(SheetJS): two unfixed **high** advisories — prototype pollution and a ReDoS —
with no patched release on npm, on a direct production dependency that parsed
files an end user uploads. It is gone.

One capability went with it: ExcelJS reads `.xlsx` but not the legacy `.xls`
BIFF format. Rather than silently returning an empty sheet, `parseTabularFile`
rejects `.xls` with an instruction to re-save, and every caller surfaces the
message. **If your customers still upload `.xls`, this is a behaviour change
you need to know about.**

## Housekeeping left over from the Baileys removal

The unofficial WhatsApp Web transport is gone — service, routes, models, UI,
npm dependency and per-org feature flag. The only messaging path is the Cloud
API. Two loose ends remain, neither of which a reviewer can see:

- Two now-unusable Mongo collections were left for a deliberate manual drop.
  `baileysauthstates` is the one worth prioritising: it holds live pairing
  credentials for a client that no longer exists, which is not material you
  want sitting in a production database.

  ```js
  db.baileysauthstates.drop();   // unusable WhatsApp Web pairing credentials
  // db.baileysmessages.drop();  // historical log — archive first if you want it
  ```

- The Render service slug is still `bulk-invite.onrender.com`, a legacy name
  from that era. It is this project's own Cloud-API backend. Renaming changes
  the URL in every hardcoded reference and in the Meta dashboard, so do it
  deliberately, not mid-review.

Two explanatory comments in `backend/src/routes/externalApi.js` and
`backend/src/routes/WhatsAppCloud.js` record why an endpoint's contract
changed — `POST /campaigns/:id/send` returns `501` pointing at the
template-based `POST /api/whatsapp/broadcast`. They are history, not features.

## One domain, one constant

`frontend/src/config/publicSite.js` holds the public domain and every public
contact address. It used to be hardcoded in thirteen files — the legal pages,
the developer docs, the help centre, the footer, the App Review page. That is
precisely how a site ends up advertising one domain in its Privacy Policy while
being served from another, and Meta fetches those URLs during review.

The built bundle now contains the domain exactly once. To move domains, set
`VITE_PUBLIC_APP_URL` at build time and change no source at all.

Addresses default to `<role>@<domain>` and are individually overridable
(`VITE_SUPPORT_EMAIL` and friends). Defaulting is not the same as existing:
**confirm each mailbox actually receives mail.** A reviewer emailing an address
that bounces is worse than no address.

## Still outside this repository

Legal review of `docs/legal/`. A data retention policy implemented in code, not
just documented. Cashfree UPI Autopay verified against live docs if billing is
enabled. Load testing and a DR drill against real infrastructure. None of these
block App Review; all of them block a commercial launch.

## After approval

Messaging tier limits raise automatically as quality ratings hold up — Meta
policy, not app configuration. Requesting additional permissions later (phone
number provisioning, for instance) needs its own review.
