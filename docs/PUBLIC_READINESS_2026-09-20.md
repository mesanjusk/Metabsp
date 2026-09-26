# MetaBSP public-readiness audit — 2026-09-20

This report supersedes the 2026-09-11 "Current status" section in
`PRODUCTION_CERTIFICATION_REPORT.md`. Historical reports remain in the
repository for provenance.

## Scope

Audit target: `main` at `3df5be7cf82131bfe84bed8988bd21f8fe877c53`,
plus the remediation branch `audit/public-readiness-2026-09-20`.

The audit covered public-launch security, Mongoose/schema duplication,
MongoDB index drift, the consolidated SMB operating model, Store/SMB data
ownership, background automation, CI enforcement and stale repository state.

## Baseline verified before remediation

- Application typecheck: passing.
- Test typecheck: passing.
- Vitest: 92 files / 859 tests passing.
- Production Next build: passing; 113 static pages generated.
- Model-name collision guard: passing.
- Only two byte-identical repository files were found, both intentional
  packaging copies (desktop icon and offline page).
- Two stale PRs (#54 and #144) remained open and have been closed as
  superseded.

## Findings and remediation

| Area | Finding | Remediation |
|---|---|---|
| Next.js security | Lock already contained Next 15.5.25, the patched Next 15 backport, while npm's collapsed range still reported the RCE advisories | Pin `next` exactly to 15.5.25 and gate only the documented npm range false-positive for those two patched GHSA IDs |
| Sharp/libvips | Direct `sharp@0.33.5` remained vulnerable | Upgrade and lock `sharp@0.35.4` and its 1.3.3 libvips binary set |
| PostCSS | Next's old exact dependency pulled vulnerable 8.4.31 | Root override to `postcss@8.5.28` |
| CI security | `npm audit --omit=dev || true` could never block a release | New `security-audit.mjs` fails CI on any unapproved high/critical production advisory |
| Obsolete schema | Standalone `BusinessProfile` survived after the API moved to `SmbRecord(kind=business_profile)` | Remove the unused model; no database collection is dropped by this code change |
| Mongo indexes | `autoIndex:false` had no current consolidated drift/audit mechanism | Add admin index audit and safe create-missing action; never auto-drop indexes |
| Legacy Contact index | Production may retain globally-unique `phone_1` | Index audit explicitly identifies it as dangerous before manual removal |
| Store vs SMB product data | Catalogue/stock existed in both `StoreProduct` and generic SMB product/inventory records | `StoreProduct` is the source of truth; SMB entries are rebuildable read-only projections |
| Deprecated video wrapper | `fluent-ffmpeg` was still installed although active composition uses direct `ffmpeg-static` | Remove `fluent-ffmpeg` and its type package |
| Repository hygiene | Old pre-consolidation PRs were still mergeable/open | Close #54 and #144 as superseded |

## Store / SMB source-of-truth rule

`StoreProduct` owns catalogue name, SKU, pricing, active state and stock.
The SMB operating system receives two derived records:

- `kind=product`, reference `store-product:<id>`
- `kind=inventory`, reference `store-stock:<id>`

Both carry `data.sourceOfTruth=store_product` and
`data.readOnlyProjection=true`. The generic SMB edit/delete endpoints reject
direct edits to these projections. A signed-in Store user can rebuild every
projection with `POST /api/store/products/sync`.

Standalone SMB product/inventory records that are not Store projections remain
editable for businesses that do not use E-Store.

## Mongo index operating rule

Use `GET /api/system/indexes` as an administrator to inspect drift.
`POST /api/system/indexes` with `{"action":"create-missing"}` is allowed to
create schema-declared indexes only on collections that already exist.

No API in this remediation automatically drops an index. Dangerous/extra
indexes must be reviewed against production data before manual removal.

## Automation position

The platform currently runs persistent background workers for WhatsApp sends,
inbound webhooks and video jobs, plus schedulers for token refresh, billing,
backups, keep-alive, data retention and Google review automation. Redis leader
locks protect scheduled work across replicas.

Growth Intelligence remains advisory/human-in-the-loop for cross-module
business decisions. That is intentional for actions involving money, outbound
customer contact or public posting unless the merchant has explicitly enabled
an automation.

## Public launch gate

Do not treat a green build alone as public certification. Before unrestricted
public onboarding, require all of the following:

1. CI verify and dependency-security jobs green on the remediation commit.
2. Production index audit reviewed, with zero unexplained dangerous indexes.
3. Missing indexes created on existing production collections.
4. Live Meta preflight green for the production app/customer onboarding path.
5. Production Redis, MongoDB, token encryption and backup settings verified.
6. Legal/customer-facing policies reviewed for the actual production settings,
   especially retention periods and subprocessors.
7. A controlled smoke test covering signup, business profiling, WhatsApp
   onboarding, inbound/outbound message, Store product, SMB projection and GBP.

