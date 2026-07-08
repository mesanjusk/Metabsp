# Customer onboarding

## The actual flow, today

1. **Sign up** for the platform (standard email/mobile + password signup —
   `bulk/routes/authRoutes.js`/`bulk/controllers/authController.js`).
2. **Connect WhatsApp** — from the WhatsApp dashboard, **Connect with
   Meta** (Embedded Signup, see `EMBEDDED_SIGNUP.md`) or **Connect
   manually** (paste an existing token, see `OAUTH.md`).
3. **Start sending** — no admin/support intervention required for a
   customer who already has a WhatsApp Business Account. This is a real,
   working self-service path, verified in the production audit.

This already satisfies "customer self-service onboarding" — no separate
multi-step "wizard" UI was built on top of this, since the existing
Connect-with-Meta / Connect-manually flow plus the account switcher
(`WhatsAppNumbersPanel.jsx`) already covers the same ground without adding
a new UI surface to maintain. If a more guided, screen-by-screen wizard
experience is wanted later, that's a product decision to scope
separately rather than something implied by "onboarding" being
technically incomplete.

## Migrating a number that's already on WhatsApp elsewhere

If a customer's number is already active on consumer WhatsApp, WhatsApp
Business App, or with a different BSP, Meta's number-migration process
(2-step verification / PIN transfer) happens **entirely on Meta's side**,
before the number reaches this app at all — Meta requires the current
owner to release/verify the number as part of connecting it via Cloud API
elsewhere. Once that's done, the number is just a normal already-registered
WhatsApp Business number from this app's perspective, and connects through
the exact same Embedded Signup or manual-connect flow as any other number
— no separate "migration mode" exists or is needed in this codebase.
What customer support needs to know: point the customer to Meta's own
number-migration instructions first if they mention an existing WhatsApp
number, then run them through the normal connect flow once that's done.

## Multiple numbers / multiple WABAs

A customer can connect and switch between several numbers
(`WhatsAppNumbersPanel.jsx` → "Connect another number"); only one is
"active" at a time per the partial-unique-index invariant on
`WhatsAppAccount.isActive`, switchable without disconnecting others.

## Adding team members

Account owners can share access to one connected number with other
platform users via **System User token** panel's neighboring **Team
inbox** section — see `SYSTEM_USER_CREATION.md`'s sibling feature in the
same `WhatsAppNumbersPanel.jsx`/`TeamManagementPanel.jsx`, added by
mobile number.

## Disconnecting a number

`POST /account/:id/disconnect` marks the account `status: 'disconnected'`,
`isActive: false`, and releases the phone-number claim
(`numberClaimed: false`) so the same number can be reconnected later
(by this customer or, if genuinely released on Meta's side, another).

## Reconnecting

Reactivating a disconnected account (`POST /accounts/:id/activate`)
re-checks the phone number is still available to this user
(`assertPhoneNumberAvailable`) before atomically re-activating it — see
the account-activation race-condition fix from this session's work for
why this is now a single atomic operation rather than a read-then-save.
