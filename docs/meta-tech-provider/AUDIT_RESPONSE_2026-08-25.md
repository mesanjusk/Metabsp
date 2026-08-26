# Response to the Meta App Review audit (2026-08-25)

Answers to the audit's open questions, verified against the codebase and the
Render dashboard rather than inferred from the browser, plus the exact values
to set in the Meta App Dashboard.

## The auditor's three open questions

### "What does the single `business_management` API call actually do?"

One call: `GET /{business-id}/owned_whatsapp_business_accounts`, in
`backend/src/services/whatsappCredentialValidationService.js:59`.

It runs **only on the manual-connect path** (`manualConnect` and
`updateManualAccount` in `whatsappController.js`), where a business
administrator supplies an existing access token instead of going through
Embedded Signup. The call confirms the WABA being claimed genuinely belongs to
the business supplying it, before any token is stored.

That is the entire usage. One lifetime API call is exactly what a
validation-only, manual-path-only operation looks like — the number is
consistent with the code, not evidence of a stale permission. The narrow
justification in `APP_REVIEW_SUBMISSION_TEXT.md` describes precisely this and
claims nothing more.

### "Is `bulk-invite.onrender.com` dead code, or still in use?"

**In use, and it is this project's own backend.** Verified in Render:

| | |
|---|---|
| Service name | `MetaBSP` |
| Service ID | `srv-d8hok2rtqb8s73aba29g` |
| Repo | `mesanjusk/Metabsp`, `rootDir: backend`, branch `main` |
| URL | `https://bulk-invite.onrender.com` |

`bulk-invite` is a legacy **Render service slug** from when the service was
first created. It has nothing to do with unofficial WhatsApp automation. The
auditor was right to flag the name — it is genuinely misleading — but the
concern behind the flag does not apply.

The Baileys transport it was named after has since been removed from the
codebase entirely (`docs/BAILEYS_REMOVAL.md`). Renaming the Render service
would remove the ambiguity, at the cost of changing the URL every hardcoded
reference and the Meta dashboard point at — worth doing deliberately, not
mid-review.

### "Can you log in so the audit can continue through the authenticated flow?"

Not something an assistant can do — it needs a real reviewer account, which is
the outstanding blocker tracked in `APP_REVIEW_SUBMISSION_TEXT.md`. The account
has to be created by the owner (signup requires a WhatsApp-delivered OTP, so it
cannot be self-served), then `VITE_REVIEWER_LOGIN` / `VITE_REVIEWER_PASSWORD`
set in Vercel.

## Corrections the audit forced

### `public_profile` — drop it. The audit is right, and an earlier draft here was wrong.

Meta's usage table shows **0 lifetime calls**, and the code confirms why:

- `completeEmbeddedSignup` makes exactly three Graph calls —
  `oauth/access_token` twice, then `GET /{phone-number-id}`. It never calls
  `/me`.
- The only `/me` in the WhatsApp path is in
  `whatsappCredentialValidationService.js`, on the manual-connect path only,
  using the **customer's WhatsApp token**. A `/me` with a system user or WABA
  token returns that token's app-scoped ID — it does not require
  `public_profile`, which governs Facebook Login user tokens.

An earlier revision of `APP_REVIEW_SUBMISSION_TEXT.md` claimed `/me` was called
"during Embedded Signup and manual connect". That was false for Embedded
Signup. It has been corrected, and the permission is now marked **drop**.

### Hardcoded hosts in the shipped bundle

The audit found three API hosts in the production bundle. Two are now fixed:

| Host | What it was | Action |
|---|---|---|
| `bulk-invite.onrender.com` | The real backend (see above), plus a hardcoded fallback in `frontend/src/api.js` | Fallback changed to a relative `/api` — a build missing `VITE_API_URL` now fails visibly instead of silently reaching the live backend |
| `metabsp.com/api/auth/facebook/data-deletion` | Hardcoded on the Data Deletion page — a third domain, matching neither the site nor the API host, so the URL it advertised did not resolve | Now derived from `VITE_PUBLIC_APP_URL`, overridable with `VITE_DATA_DELETION_CALLBACK_URL` |
| `mis-both.onrender.com` | Comes from the **Meta dashboard**, not the bundle | See blocker below |

### `mis-both.onrender.com` is the most serious finding

Both the **webhook callback URL** and the **Valid OAuth Redirect URI** point at
`mis-both.onrender.com`. This project's backend is `bulk-invite.onrender.com`.
They are different hosts, and `mis-both.onrender.com` does not appear among the
Render services in this account.

If that host is dead, then inbound webhooks — customer messages, delivery
statuses, and all three coexistence fields — are being delivered nowhere, and
the OAuth redirect fails under Strict Mode. Subscribing to webhook *fields*
(which the pre-flight check confirms) says nothing about whether the *callback
URL* resolves; those are independent settings.

**Verify this before anything else.** The correct value for the current
deployment is `https://bulk-invite.onrender.com/webhook` (also served at
`/api/whatsapp/webhook` — same handler, see `backend/src/app.js`).

## Exact Meta App Dashboard values

| Where | Field | Set to |
|---|---|---|
| Settings → Basic | App Domains | `meta.sanjusk.in` and `metabspnext.onrender.com` |
| Settings → Basic | Site URL | `https://meta.sanjusk.in/` |
| Settings → Basic | Privacy Policy URL | `https://meta.sanjusk.in/privacy-policy` |
| Settings → Basic | Terms of Service URL | `https://meta.sanjusk.in/terms-of-service` |
| Settings → Basic | Data deletion URL | `https://meta.sanjusk.in/data-deletion` |
| **Facebook Login for Business → Settings** | **Allowed Domains for the JavaScript SDK** | `https://meta.sanjusk.in` and `https://metabspnext.onrender.com` |
| Facebook Login for Business → Settings | Valid OAuth Redirect URIs | `https://meta.sanjusk.in/login` |
| WhatsApp → Configuration | Webhook Callback URL | `https://meta.sanjusk.in/webhook` once the Next.js host serves that domain |
| App Review | Testing Instructions | Replace wholesale — see `APP_REVIEW_SUBMISSION_TEXT.md` |
| App Review | Permissions requested | `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management` — **drop `public_profile`** |

### Allowed Domains for the JavaScript SDK is not optional

Leaving it unset produces, at the moment a customer clicks **Connect with Meta**:

> **JSSDK unknown host domain** — The domain you are hosting the Facebook
> Javascript SDK is not in your app's Javascript SDK host domain list.

This blocks **Embedded Signup**, not just Facebook login. Both call `FB.login`
through the same SDK (`lib/client/facebookSdk.js`), so an unlisted host stops
onboarding dead — which is precisely the flow App Review is assessing.

Every host the app is *served from* needs listing, scheme included and no
trailing slash. During the Vercel→Render cutover that means both the live
domain and the Render URL, because the Render URL is where testing happens
before DNS moves.

**Embedded Signup config ID: `1003501095782121`.** The audit reports two
configurations; only "ES Config" is in use. `META_EMBEDDED_SIGNUP_CONFIG_ID`
must be set to this value. (A value read from a screenshot earlier in this work
was truncated to 15 digits — this 16-digit value is the correct one.)

The legacy "WABA" configuration (`901647292356075`) requests only
`whatsapp_business_management` and is unused by the current flow. Leave it
alone during review rather than deleting it mid-submission.

## Confirmed accurate in the audit

- **Instagram**: no implementation exists. One incidental comment mention in
  the codebase, nothing more. Requesting no Instagram permissions in this
  submission is correct.
- **Frontend is Vite, not Next.js**. The bundle observation is right. A partial
  Next.js port exists under `nextjs/` but is not what serves
  `meta.sanjusk.in`; consolidation is planned, not done.
- **No Baileys in the production bundle** — consistent with removal.
- **Contact-address mismatch** (`@metabsp.com` addresses on a site served from
  `meta.sanjusk.in`, with a personal Gmail as the app contact). Not a blocker,
  but it does read oddly to a reviewer.

## Not verifiable from here

The audit defers the video storyboard and the authenticated walkthrough until
someone signs in. That remains the right call — and it is the same blocker as
the reviewer account. Nothing else in the submission can be finalised honestly
until that flow has been walked end to end by a person.
