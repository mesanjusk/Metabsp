# Google Business Profile

The Google service is the local-growth half of the SMB Digital OS: the customers who
find a shop on Google Search and Maps, the reviews they leave, and the posts that
keep the listing alive. It runs on Google's own Business Profile APIs and the
WhatsApp number this workspace already owns.

## Why Google's APIs and not a marketing vendor

There is a category of "AI marketing platform for local business" — Grexa AI,
Birdeye, Podium, Broadly, Localo — and they are all worth reading for the product
shape, which is why the workspace copies it: AI review replies, AI profile posts,
review requests, and a performance number an owner can act on.

None of them is worth *integrating*, because they are not providers. Every one of
them is a tenant of the same public Google APIs used here. Buying one would mean:

- a second vendor between this workspace and the merchant's own profile, priced per
  location per month, on top of what the merchant already pays here;
- a second customer record, which is the one thing the core data rule forbids
  (`docs/SMB_DIGITAL_OS.md` — one `Contact`, one shared history);
- no access to anything this platform does not already have. Google's APIs are
  free and first-party, and Anthropic's API supplies the drafting.

The merchant authorises Google directly with their own account, so the connection is
theirs. Disconnecting here revokes the grant at Google too.

The part a standalone vendor genuinely cannot do is the last one: a review request
sent over the business's own WhatsApp number, into the same inbox that holds the
rest of the conversation.

## Google setup

1. In a Google Cloud project, enable the Business Profile APIs: **Account
   Management**, **Business Information**, **My Business (v4)** and **Business
   Profile Performance**.
2. Request API access at
   <https://developers.google.com/my-business/content/prereqs>. A newly enabled
   project has a quota of **0** until Google approves — every call 429s before then.
3. Create an OAuth 2.0 **Web application** client. Add the redirect URI
   `<FRONTEND_URL>/api/google-business/oauth/callback`.
4. Give the client to the platform, either way round:
   - **Administration → Google configuration** in the dashboard (admin only). The
     secret is encrypted with the same key as every other provider secret and
     can be rotated without a redeploy.
   - or `GOOGLE_BUSINESS_CLIENT_ID` / `GOOGLE_BUSINESS_CLIENT_SECRET` in the
     environment (or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from the same
     project).
5. For AI drafting, set `ANTHROPIC_API_KEY`.

Scope requested: `https://www.googleapis.com/auth/business.manage` — the only scope
these APIs accept. The deprecated `plus.business.manage` alias is not requested.

## Whose credential is whose

Two different things are called a credential here and confusing them is the easy
mistake:

| | Platform OAuth client | Merchant authorization |
| --- | --- | --- |
| Model | `PlatformCredential` (one row for the deployment) | `GoogleBusinessAccount` (one row per user) |
| Set by | A platform administrator, once | The merchant, by pressing Connect |
| Equivalent to | `META_APP_ID` / `META_APP_SECRET` | A connected WhatsApp number |

A merchant must never be asked for the client ID and secret. Per-merchant clients
would mean every shop running its own Google Cloud project and winning its own
Business Profile API approval — weeks of waiting for something only the platform
needs once. The merchant-facing flow is Google's consent screen, which is the
Google equivalent of Meta's Embedded Signup and is already what the Connect
button does.

**Precedence:** a stored client beats the environment, and the resolver reports
which one won so the admin screen can say so. The rule lives in the pure
`getGoogleBusinessConfig(stored?)`; the database read is separate
(`loadStoredGoogleCredential`, which never throws — an unreachable database or a
secret that will not decrypt falls through to the environment rather than taking
the connection down). Half a stored credential is not a credential: a row whose
secret failed to decrypt does not shadow a working environment pair.

The secret is write-only. No endpoint returns it, including to the admin who set
it; the screen confirms with the last four characters instead.

## Connection model

`GoogleBusinessAccount` holds one live connection per dashboard user. Google's flow
is a refresh-token flow, so the refresh token is the durable credential and is
encrypted with the same `WHATSAPP_TOKEN_ENCRYPTION_KEY` as every other provider
secret. The hour-long access token is cached beside it and refreshed on demand, so
one page load costs one token call rather than one per endpoint.

The authorization URL sends `access_type=offline` **and** `prompt=consent`. Without
both, Google returns an access token and no refresh token, and the connection dies
silently an hour later.

A connection also stores which account and location it manages. Google addresses
reviews and posts as `accounts/{account}/locations/{location}`, so both halves are
needed; a connection with no location selected is reported as `pending` everywhere,
never as connected.

## APIs

| Route | Method | What it does |
| --- | --- | --- |
| `/api/google-business/oauth/url` | GET | Signed-state authorization URL |
| `/api/google-business/oauth/callback` | GET | Token exchange, preselects a single location |
| `/api/google-business/account` | GET | Connection, plus whether the server is configured for Google and for AI |
| `/api/google-business/account` | PATCH | Choose the account/location to manage |
| `/api/google-business/account` | DELETE | Disconnect and revoke at Google |
| `/api/google-business/locations` | GET | Accounts and locations for the picker |
| `/api/google-business/reviews` | GET / POST / DELETE | List, reply, remove reply |
| `/api/google-business/posts` | GET / POST | List and publish profile posts |
| `/api/google-business/performance` | GET | Daily Search/Maps metrics, rolled up |
| `/api/google-business/ai/draft` | POST | Draft a review reply, a post, or a review request |
| `/api/google-business/review-requests` | POST | Send a review request over WhatsApp |
| `/api/google-business/admin/credentials` | GET / PUT / DELETE | Admin-only: the platform's own OAuth client. Audit-logged; never returns the secret |

All routes authenticate through the shared session and resolve the `google-business`
entitlement, which is a basic service included with every account.

## AI drafting

Nothing is published by the model. `kind: 'review-reply' | 'post' | 'review-request'`
returns text into an editable box, and the owner presses the button. A profile reply
is public and permanent under the merchant's name, which is the wrong place for an
unattended model — and an owner who only has to approve a line still saves the twenty
minutes of blank-box staring that stops most replies being written at all.

A review reply is drafted from the review **Google holds**, fetched server-side by
id, not from review text the browser supplies.

The prompts forbid inventing offers, prices, hours or policies, and the review-request
prompt forbids offering anything in exchange for a review or asking only for positive
ones — both are Google policy violations that can get a profile penalised.

## Review requests and the 24-hour window

A review request is a free-form WhatsApp text, so it is bound by the same 24-hour
customer-care window as every other free-form send. Outside it, the route answers
with the reason and points at Broadcasts, where an approved template can be used —
rather than surfacing Meta's error code.

`{{link}}` in the message is replaced with the location's Google review link
(`newReviewUri`); a message without it gets the link appended.
