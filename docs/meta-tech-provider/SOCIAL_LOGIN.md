# Google / Facebook sign-in

Additive to the existing username-or-mobile + password login. Each provider
stays hidden on the login page until it is configured, so a deployment that
sets neither keeps exactly the login page it has today.

Both paths issue the same JWT as password login, so `requireAuth`, roles and
tenancy behave identically however a user signed in.

## Google — recommended, and the simpler of the two

1. Google Cloud Console → **APIs & Services → Credentials → Create
   credentials → OAuth client ID → Web application**.
2. Add your app's origin (e.g. `https://meta.instify.in`) under **Authorised
   JavaScript origins**. No redirect URI is needed — the browser receives an ID
   token directly and posts it to us.
3. Set `GOOGLE_CLIENT_ID` on the backend. The client *secret* is not used:
   ID tokens are verified against Google's `tokeninfo` endpoint rather than
   exchanged.

Google returns a **verified** email, which is what allows sign-in to link to an
existing account instead of creating a duplicate. That makes it the better
option for this product.

## Facebook — requires a product you probably do not have yet

**Facebook sign-in will not work on a Meta app configured only for WhatsApp.**
The symptom is the login dialog refusing to open:

> It looks like this app isn't available — This app needs at least one
> supported permission.

The cause is that *Facebook Login for Business* and *Facebook Login* are
different products. Embedded Signup uses the former, selected by
`META_EMBEDDED_SIGNUP_CONFIG_ID`. `FB.login()` for user authentication uses
the latter, which a WhatsApp Business Messaging app does not have by default.

To enable it:

1. Meta App Dashboard → **Use cases** → add **Authentication and account
   creation** (this is what provides ordinary Facebook Login). Include the
   `email` permission if you want account linking to work.
2. Set **both** `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`. These do **not**
   fall back to `META_APP_ID`/`META_APP_SECRET` — that fallback used to exist
   and was wrong, because it made the button appear on every WhatsApp
   deployment whether or not Facebook Login was enabled. To use the same Meta
   app for both, set `FACEBOOK_APP_ID` to the same value as `META_APP_ID`.
3. Only after step 1 grants the `email` permission, set
   `FACEBOOK_LOGIN_SCOPES=public_profile,email`. Requesting a scope the app
   does not have fails the whole dialog with `Invalid Scopes: email`.

### Consider whether it is worth it

Adding a consumer Facebook Login product to an app that is mid-App-Review for
WhatsApp permissions widens the surface a reviewer sees, for a sign-in method
Google already covers better. Without the `email` permission, every Facebook
sign-in creates a *new* account rather than linking to an existing one — see
below for why that is deliberate.

## How accounts are matched

In order, most trustworthy first:

1. An account already carrying that provider ID → sign in.
2. An account whose email matches **and the provider verified it** → link the
   provider to that account, then sign in.
3. Otherwise → create a new account, with no password set.

An existing account matched on an **unverified** email is refused, not linked:
anyone able to claim that address at a provider would otherwise inherit the
account. The user is told to sign in with their password first and link from
settings.

## Security notes

- The browser sends only the opaque provider credential. The profile behind it
  is always fetched server-side — a client-supplied profile would let anyone
  post someone else's email and be signed in as them.
- Audience is checked, not just signature. A Google ID token is validly signed
  for *some* application; without comparing `aud` to our own client ID, a token
  minted for an unrelated app would be accepted. Facebook's equivalent is
  `debug_token`'s `app_id`.
- Social-only accounts have no password at all. `password` is required in the
  schema only when neither provider ID is present, and `matchPassword` refuses
  an empty stored or candidate password outright.
