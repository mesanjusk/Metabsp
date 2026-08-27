# App Review — submission text, ready to paste

Copy each block into the matching field in the Meta App Dashboard. These
replace the text submitted on 2026-07-13, which was rejected-prone for four
reasons, all fixed here:

1. `[Your Name]` was left in two justifications — an unmistakable sign to a
   reviewer that a template was pasted unread.
2. `public_profile` was requested at all. It has zero usage; the fix is to drop it, not to write a justification.
3. `business_management` was justified as "register and manage phone numbers",
   which is `whatsapp_business_management`'s job. Overclaiming on
   `business_management` is a common rejection trigger; the text below narrows
   it to the one Graph call this app actually makes with it.
4. The reviewer instructions said no credentials were required. They are: the
   WhatsApp dashboard sits behind `CloudProtectedRoute`, `/connect/config` and
   `/connect/complete` are `requireAuth`, and signup needs a WhatsApp-delivered
   OTP — so a reviewer could not reach the Embedded Signup button at all. This
   is almost certainly why the submission stalled.

Every claim below is checked against the code. Do not add capabilities the app
does not have; a reviewer who finds one overstatement distrusts the rest.

---

## `whatsapp_business_messaging` → "Tell us how you're using this permission"

> MetaBSP is a multi-tenant WhatsApp Business Platform that lets a business
> connect its own WhatsApp Business Account and send template-based customer
> notifications, with automated replies to inbound messages.
>
> We use `whatsapp_business_messaging` to send and receive messages on behalf
> of the business that has connected its own WABA through Meta's Embedded
> Signup flow. Specifically:
>
> - Sending pre-approved template messages that the connected business composes
>   in our dashboard, either to one recipient or as a broadcast to a recipient
>   list it supplies.
> - Sending text and media replies inside Meta's 24-hour customer service
>   window, via automated replies and multi-step workflows the business
>   configures.
> - Receiving inbound customer messages and delivery/read statuses through our
>   webhook endpoint. These drive the automated replies, keep the business's
>   contact records current, and determine whether the 24-hour window is open.
> - Uploading and retrieving media attached to those messages.
>
> All messaging is initiated either by the business's own staff or by a
> customer messaging that business first. We enforce Meta's 24-hour customer
> service window in code: outside it, only approved template messages can be
> sent. We never message a person who has not contacted the connected
> business or opted in through it.
>
> We do not use this permission for any purpose beyond operating the connected
> business's own messaging, and we do not share message content between
> tenants.

## `whatsapp_business_management` → "Tell us how you're using this permission"

> We use `whatsapp_business_management` to read and manage the WhatsApp
> business assets a customer has explicitly granted us through Embedded
> Signup. Specifically:
>
> - Reading the connected phone number's `display_phone_number` and
>   `verified_name` so the dashboard shows the business which number it has
>   connected.
> - Listing, creating, and checking the approval status of that business's
>   message templates.
> - Subscribing our app to the customer's WABA
>   (`POST /{waba-id}/subscribed_apps`) so their messages actually reach our
>   webhook. Without this, a newly connected number receives nothing.
> - Reading the number's `platform_type` to detect whether it was onboarded
>   through Coexistence and remains active in the customer's WhatsApp Business
>   app.
>
> We only ever access assets belonging to a business that has completed
> Embedded Signup and granted us access. We do not enumerate, read, or modify
> assets belonging to any other business.

## `business_management` → "Tell us how you're using this permission"

> We use `business_management` for one narrow purpose: reading
> `owned_whatsapp_business_accounts` on the connecting business, to confirm
> that a WhatsApp Business Account genuinely belongs to the business supplying
> it before we store a token for it.
>
> This runs only on our "connect manually" path, where a business
> administrator supplies an existing access token instead of going through
> Embedded Signup. Validating ownership prevents a token from being attached
> to a WABA the supplying party does not actually control.
>
> We do not create, claim, or modify any business asset with this permission,
> and we do not touch ad accounts, Pages, catalogs, or any other Business
> Manager asset. It is used solely as a read-only ownership check during
> onboarding. If Meta would prefer this validation be done another way, we are
> happy to adjust it.

## `public_profile` → **drop this permission**

Do not re-request it. Meta's own usage table shows **0 lifetime API calls**,
and the code agrees:

- `completeEmbeddedSignup` (`backend/src/controllers/whatsappController.js`)
  makes exactly three Graph calls — `oauth/access_token` twice and
  `GET /{phone-number-id}`. It never calls `/me`.
- The only `/me` call in the WhatsApp path is in
  `whatsappCredentialValidationService.js`, on the **manual connect** path
  only, and it uses the customer's own WhatsApp token. A `/me` with a system
  user or WABA token returns that token's app-scoped ID; it does not need
  `public_profile`, which governs Facebook Login user tokens.

An earlier draft of this file claimed `/me` was called "during Embedded Signup
and manual connect". That was wrong for Embedded Signup, and requesting a
permission the app does not exercise is precisely the kind of overclaim that
gets a submission rejected. Remove `public_profile` from the request.

(If Google/Facebook social sign-in is ever deployed,
`backend/src/services/socialAuthService.js` does call `/me` with a Facebook
Login token — but that is a separate feature, not deployed today, and belongs
in its own submission.)

---

## Web reviewer instructions

**This is the field that matters most.** The 2026-07-13 submission said no
credentials were required. They are: the WhatsApp dashboard is behind
`CloudProtectedRoute`, `/connect/config` and `/connect/complete` are
`requireAuth`, and signup needs a WhatsApp-delivered OTP — so a reviewer could
not reach the Embedded Signup button at all. That is almost certainly why it
stalled.

Create the account first:

```
REVIEWER_LOGIN=meta_reviewer \
REVIEWER_PASSWORD=<a strong password you generate> \
REVIEWER_CONTACT_EMAIL=<your support address> \
PUBLIC_APP_URL=https://<your app domain> \
npm run seed-reviewer --workspace=backend
```

It prints the block below with your real values filled in. Paste that output —
not this template — into App Review → Testing Instructions.

> The WhatsApp features in this app are behind a login, so credentials are
> required. Self-registration is not possible: signup requires a one-time code
> delivered over WhatsApp.
>
> Application URL: {PUBLIC_APP_URL}/login
> User Name: {REVIEWER_LOGIN}
> Password: {REVIEWER_PASSWORD}
>
> The login form asks for "User Name" and "Password". Enter the values above
> exactly — the first field is not an email address or a phone number.
>
> Steps to review each requested permission:
>
> 1. Sign in with the credentials above. You land on the WhatsApp dashboard
>    at /whatsapp.
> 2. The "Meta" tab is selected by default.
> 3. Click "Connect with Meta" to launch Meta's Embedded Signup popup. Sign in
>    with a Facebook account that has a WhatsApp Business Account and grant the
>    requested permissions. On completion the app exchanges the authorization
>    code for a token, reads the phone number's details, and subscribes itself
>    to the WABA's webhooks — all `whatsapp_business_management`.
> 4. To see `business_management`: choose "Connect manually" instead and supply
>    an existing access token. The app reads
>    `owned_whatsapp_business_accounts` on the supplied business to confirm the
>    WABA genuinely belongs to it before storing anything.
> 5. Open the "Templates" tab to see template listing and creation
>    (`whatsapp_business_management`), and send an approved template to a
>    recipient from the same tab (`whatsapp_business_messaging`).
> 6. Open the "Broadcast" tab to send an approved template to several
>    recipients at once (`whatsapp_business_messaging`). Delivery and read
>    statuses arrive over our webhook and are reflected against each recipient.
> 7. Open the "Auto Reply" tab to see how inbound customer messages are handled:
>    a matching keyword triggers a reply sent inside Meta's 24-hour window
>    (`whatsapp_business_messaging`). Message a connected number from a phone to
>    see the reply arrive.
>
> If the reviewer account stops working at any point, please contact
> {REVIEWER_CONTACT_EMAIL} and we will restore access immediately.

This platform does not present a human agent inbox: inbound messages are
received and acted on (automated replies, workflows, contact records, the
24-hour window), but there is no conversation view for staff to read and reply
in. The steps above are written to demonstrate `whatsapp_business_messaging`
through the surfaces that do exist — template send, broadcast, and automated
reply — rather than claiming an inbox a reviewer would then go looking for.

Every label above is the one actually rendered: the login field is **"User
Name"** (an earlier draft said "Mobile / Username", which is the *other* login
page at `/bulk-login` — a reviewer following that instruction on `/login` would
have been looking for a field that is not there, and login matches on
`username` only, so a phone number would not have worked either).

### Creating the reviewer account

`npm run seed-reviewer --workspace=backend` creates it. The script builds
exactly what `POST /api/users/signup/verify` builds — same global role, same
`tenantId: null` — so the reviewer's session is indistinguishable from an
ordinary one. There is no review-only bypass, no elevated role, and no code
path that behaves differently for this user.

Re-running it resets the password and re-activates the account, so a reviewer
locked out mid-review can be let back in with one command.

There are no default credentials, and none are committed: this repository is
public, and a working login in git is a credential leak. Set
`VITE_REVIEWER_LOGIN`, `VITE_REVIEWER_PASSWORD` and `VITE_PUBLIC_APP_URL` in
Vercel if you want `/meta-app-review` to display the same values.

**Verify before submitting.** `npm run submission-check --workspace=backend`
confirms the account exists and is active. It cannot confirm the password
works, so also open a private browser window, sign in with exactly those
credentials, and reach the "Connect with Meta" button. If you cannot, neither
can the reviewer.
