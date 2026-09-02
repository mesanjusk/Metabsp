# App Review — submission text, ready to paste

Copy each block into the matching field in the Meta App Dashboard.

Every claim below is checked against the code in this repository, with the
file and line that backs it. Do not add capabilities the app does not have: a
reviewer who finds one overstatement distrusts the rest, and the fastest way
to fail is to describe a product that is adjacent to the one you built.

**The product is called SanjuSK** in everything a reviewer sees — the
wordmark, the legal pages, the consent dialog and `/meta-app-review`. Use that
name here too. "Metabsp" survives only as a repository name, a webhook
signature header and some database role codes; none of those are branding.

---

## The "Testing instructions" form

### Is Facebook Login integrated on this platform? → **Yes**

Answer yes. Embedded Signup *is* Facebook Login for Business:
`nextjs/lib/ui/hooks/useWhatsAppConnection.js:123` calls `window.FB.login`
with a `config_id`, `response_type: 'code'` and
`override_default_response_type: true`. There is no version of this product
that answers no.

### Confirmation of Meta APIs / Facebook Login use

> Facebook Login is used in one place only: Facebook Login for Business, as
> the transport for WhatsApp Embedded Signup. A business owner clicks "Connect
> with Meta", completes Meta's Embedded Signup popup, and the app exchanges
> the returned authorization code server-side for a WhatsApp Business Account
> token.
>
> We do not request or use `email`, `public_profile`, `user_friends`,
> `user_gender`, `user_birthday`, or any other user-profile permission. No
> Meta API is called for personal profile data at any point.
>
> The codebase contains an optional consumer Facebook sign-in path, but it is
> disabled on this deployment: it requires `FACEBOOK_APP_ID` and
> `FACEBOOK_APP_SECRET`, neither of which is set, so the provider endpoint
> reports it disabled and no Facebook sign-in button is rendered. Sign-in is by
> mobile number and password only.

That last paragraph is a factual claim about the deployment, so keep it true.
`isFacebookEnabled()` (`nextjs/lib/services/socialAuthService.ts:53`) requires
both variables, and neither appears in `nextjs/.env.example` or `render.yaml`.
If you ever set them, the Facebook button appears on the login page and this
paragraph becomes false — rewrite it before submitting again.

### The remaining fields

- **Payment / test credentials** — no payment is required to reach any
  reviewed functionality. Supply the reviewer login below.
- **Gift codes** — not applicable; this is not a store app.
- **Geographic restrictions** — none. No geo-blocking or geo-fencing.

---

## `whatsapp_business_messaging` → "Tell us how you're using this permission"

The field asks three things, and a submission that answers only the first is
the most common way to be refused: **how** the app uses the permission, **what
value it adds** for the person using the app, and **why it is necessary** for
the app to function. Answer all three, in that order, in one block.

> **How we use it.** SanjuSK is a multi-tenant WhatsApp Business Platform. A
> business connects its own WhatsApp Business Account through Meta's Embedded
> Signup flow, and from then on manages its customer conversations from a
> shared team inbox at https://meta.sanjusk.in. We use
> `whatsapp_business_messaging` on behalf of that connected business, and only
> for its own conversations:
>
> - Sending text, media and pre-approved template messages that the business's
>   own staff compose, schedule or trigger from our dashboard.
> - Receiving that business's inbound customer messages, plus delivery and
>   read statuses, through our webhook endpoint, so staff can reply from the
>   shared inbox.
> - Uploading and retrieving the media attached to those messages.
> - Registering a connected phone number with Cloud API during onboarding.
>
> **The value it adds.** The person using our app is an employee of the
> connected business — typically a small team sharing one WhatsApp number.
> Without this permission they are limited to the WhatsApp Business app on a
> single handset: one person holds the phone, there is no way to assign a
> conversation to a colleague, no history when someone leaves, and no record of
> who replied. Our app turns that number into a shared inbox with per-agent
> accounts, assignment, searchable history, saved replies and templates —
> which is what a business with more than one person answering customers
> actually needs.
>
> **Why it is necessary.** Sending and receiving messages is not a feature of
> this product alongside others; it is the product. Every screen in the app —
> the inbox, conversation assignment, templates, delivery receipts, automated
> replies — exists to compose, deliver or display a WhatsApp message. Without
> `whatsapp_business_messaging` a connected business can see its account and
> nothing else: no message can be sent, and no customer reply can arrive.
>
> **Compliance.** All messaging is initiated either by the connected
> business's own staff or by a customer who messaged that business first. We
> enforce Meta's 24-hour customer service window in code: outside it, only
> approved template messages can be sent. We never message a person who has
> not contacted the connected business or opted in through it, we do not share
> message content between tenants, and we use this permission for no purpose
> beyond operating each connected business's own conversations.

The 24-hour claim is enforced and tested — `nextjs/tests/twentyFourHourGuard.test.ts`.
The tenant-isolation claim rests on Socket.IO being authenticated and
room-scoped (`nextjs/tests/socketEmitter.test.ts`). Both are worth being able
to point at if a reviewer asks.

### The screen recording for this permission

Meta requires a distinct screencast per permission and will not accept one
reused across several. The shot list for this one is
`docs/videos/26-app-review-evidence-sending-a-message.md` — record that, not a
product tour.

The single shot the recording exists for is the message arriving on a second,
physical phone. A reviewer cannot confirm a send from the sending screen alone,
because the sending screen is our own UI: it proves what our app displays, not
what Meta's API delivered. Keep everything else out of frame — template
creation belongs to `whatsapp_business_management` and video 27, and every
extra feature on screen is another thing a reviewer may ask about.

### After a refusal

A completed review that approves nothing does not say why in the notification;
the reason is on the App Review page itself, per request. Read it before
changing anything here. Resubmitting the same evidence with a longer
description is how an app gets refused twice — and the three most common
findings are all fixable: the recording did not show a real message arriving
on a real device, the reviewer could not sign in with the supplied
credentials, or the description claimed behaviour the reviewer could not see
in the app.

Confirm the reviewer login still works before every resubmission —
`npm run seed:reviewer` recreates it — and check the credentials in the form
match what that script produced.

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

Backing code: the code exchange and `platform_type` read are in
`nextjs/app/api/whatsapp/embedded-signup/exchange-code/route.ts`; the
`subscribed_apps` subscription is in `nextjs/lib/whatsapp/connect.ts`.

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

One call, one place: `nextjs/lib/services/whatsappCredentialValidationService.ts:62`.
Keep the justification this narrow. Describing `business_management` as
"registering and managing phone numbers" — which is
`whatsapp_business_management`'s job — is a common rejection trigger.

## `public_profile` → **drop this permission**

Do not request it. Meta's usage table shows **0 lifetime API calls**, and the
code agrees:

- The Embedded Signup completion path makes only the OAuth code exchange and a
  read of the phone number. It never calls `/me`
  (`nextjs/app/api/whatsapp/connect/complete/route.ts`,
  `nextjs/app/api/whatsapp/embedded-signup/exchange-code/route.ts`).
- The only `/me` in the WhatsApp path is
  `nextjs/lib/services/whatsappCredentialValidationService.ts:31`, on the
  manual-connect path, using the customer's own WhatsApp token. A `/me` with a
  system user or WABA token returns that token's app-scoped ID; it does not
  need `public_profile`, which governs Facebook Login user tokens.

Requesting a permission the app does not exercise is precisely the overclaim
that gets a submission rejected. The consumer social sign-in that *would* use
it is disabled on this deployment (see the Facebook Login section above) and
belongs in its own submission if it is ever turned on.

---

## Reviewer instructions

**This is the field that matters most.** Fill in the bracketed values with a
real, working account, and test it yourself in a private browser window before
submitting.

The navigation below is taken from `nextjs/lib/ui/app/navigation.js`. An
earlier revision of this document sent reviewers to a sidebar entry called
"WhatsApp" and a "Chats" tab; neither exists. Re-check this section against
that file whenever the navigation changes — instructions that do not match the
screen are worse than no instructions.

> The WhatsApp features in this app are behind a login, so credentials are
> required. Self-registration is not possible: signup requires a one-time code
> delivered over WhatsApp.
>
> Application URL: [YOUR APP URL]
> Mobile number: [REVIEWER MOBILE NUMBER]
> Password: [REVIEWER PASSWORD]
>
> The first field is labelled "Mobile / Username" and expects the mobile
> number above. It is not an email address.
>
> Steps to review each requested permission:
>
> 1. Sign in with the credentials above.
> 2. In the left sidebar, open **Platform → Numbers**.
> 3. Click **Connect with Meta**. A consent disclosure appears first, stating
>    what the platform may do with the connected account; accepting it opens
>    Meta's Embedded Signup popup (Facebook Login for Business). Signing in
>    with a Facebook account that owns a WhatsApp Business Account and granting
>    the requested permissions completes onboarding: the app exchanges the
>    authorization code for a token, reads the phone number's details, and
>    subscribes itself to the WABA's webhooks — all
>    `whatsapp_business_management`.
>
>    Please note: this app currently holds **Standard Access**, which is what
>    this submission asks to change. At that level Meta's own popup offers
>    "Create a business portfolio" and does not allow selecting an existing
>    portfolio, so the flow is completed by letting it create a new portfolio,
>    WABA and test number. Everything after the popup — the code exchange, the
>    phone number read, the webhook subscription — is our integration and runs
>    identically either way. We have verified this end to end; the restriction
>    is Meta's access tier, not a limitation of the app.
> 4. To see `business_management`: on the same screen choose **Connect
>    manually** and supply an existing access token. The app reads
>    `owned_whatsapp_business_accounts` on the supplied business to confirm the
>    WABA genuinely belongs to it before storing anything. This is the only use
>    of that permission.
> 5. Open **Workspace → Templates** for template listing and creation
>    (`whatsapp_business_management`).
> 6. Open **Workspace → Inbox** and send a message to a number that has
>    messaged the business (`whatsapp_business_messaging`). Inbound messages
>    and delivery receipts appear in the same view as they arrive over our
>    webhook.
> 7. A supporting walkthrough of the same flow is at
>    [YOUR APP URL]/meta-app-review.
>
> If the reviewer account stops working at any point, please contact
> [YOUR REVIEW CONTACT EMAIL] and we will restore access immediately.

### What you can and cannot demonstrate before approval

Advanced Access is what this submission requests, so the pre-submission run
cannot exercise the thing the submission is asking for. That is the shape of
the process, not a problem to solve: Meta's guidance is explicit that "you
will not be able to onboard business customers until your app has been
approved for advanced access for each of the permissions it requires", while
"the embedded signup flow works with Standard Access for most use cases … so
you can test your app while you are in this access level".

In practice, at Standard Access:

- **Embedded Signup opens and completes**, but its asset step offers only
  "Create a business portfolio". An existing portfolio — including the
  verified one that owns the app — is not selectable. Completing the flow
  therefore creates a new portfolio, WABA and test number. Meta's own
  documentation warns that testing this way "can result in additional business
  portfolios, WABAs, and business phone numbers"; that litter is the cost of
  proving the path works.
- **Manual connect is unaffected.** Supplying an existing token exercises
  `owned_whatsapp_business_accounts`, templates, sending, receiving and
  receipts against a real WABA without going through Embedded Signup at all.

So run the pre-submission checklist across both paths: Embedded Signup for the
onboarding steps, manual connect for everything downstream of a connected
number. Between them every claim in this submission is covered.

Do not read a greyed-out portfolio as a broken integration. The check that
actually proves the integration is that the popup **opens** on your App ID
without a JavaScript SDK host error — that is the part depending on your
Allowed Domains configuration, and it is the part nothing server-side can
verify for you.

### Creating the reviewer account

**Setting `META_REVIEWER_LOGIN` and `META_REVIEWER_PASSWORD` does not create
an account.** Those variables tell the deploy gate and `/meta-app-review`
which credentials were submitted; the account behind them must already exist,
or the reviewer gets "Invalid mobile number or password" and the submission
fails for being untestable. The gate cannot catch this — it checks that three
strings are present, not that they log in.

Signup requires a one-time code delivered over WhatsApp to the number being
registered, so an account can only be self-served by someone holding that
number. Two ways to get one:

- Sign up through the normal flow with a mobile number you control and can
  receive WhatsApp on, then set a known password; **or**
- Run the seeder, which needs no OTP:

  ```
  MONGO_URI=... REVIEWER_MOBILE=... REVIEWER_PASSWORD=... npm run seed:reviewer
  ```

  It creates the account under the canonical form of the number, assigns the
  default `METABSP_USER` role (refusing if that role has been given `'*'`,
  which would hand a reviewer platform-administrator access), and hashes the
  password at the same bcrypt cost the model uses. Running it again on an
  existing account resets the password rather than failing, which is what you
  want the day before a submission.

The account is identified by its **mobile number** — `username` and `mobile`
hold the same canonical value, and sign-in normalises `+91 98765-43210`,
`9876543210` and `919876543210` to one account. Give the reviewer whichever
form you like; all three reach it.

Then set these on the Render service (not Vercel — the deployment moved):

```
META_REVIEWER_LOGIN
META_REVIEWER_PASSWORD
META_REVIEW_CONTACT_EMAIL
META_REVIEW_ENFORCE_READY=true
```

These four are read by **the deploy gate and nothing else**
(`scripts/meta-deploy-check.js`). They do not reach the application at
runtime, and setting them does not create, change or validate any account —
they record which credentials were submitted so a deployment cannot go to Meta
without them being decided.

The public `/meta-app-review` page reads a *different* pair,
`NEXT_PUBLIC_REVIEWER_LOGIN` and `NEXT_PUBLIC_REVIEWER_PASSWORD`
(`app/(public)/meta-app-review/page.jsx:65`). Leave those unset unless you
have a reason not to: `NEXT_PUBLIC_` values are baked into the client bundle
at build time, so setting them publishes the reviewer password to anyone who
opens that page. Unset, it prints "Provided in the App Review submission",
which is the right answer for a public page.

All of them are read from the environment rather than committed, because this
repository is public and a working login in git is a credential leak.

Setting `META_REVIEW_ENFORCE_READY=true` makes the deploy gate
(`scripts/meta-deploy-check.js`) *require* the three values, so a submission
cannot go out on a deployment whose reviewer login was never configured. Set
it on the exact deployment you submit.

---

## Data handling → "Do you have data processors or service providers?"

**Answer Yes.** The 2026-07-13 submission answered **No**, and that is provably
wrong: `app/(public)/privacy-policy/page.jsx` names four. A submission whose
data-handling answer contradicts its own published privacy policy is a problem
whether or not a reviewer notices, because the Data Use Checkup asks you to
certify that policy.

> Yes. The following processors have access to Platform Data:
>
> - **MongoDB Atlas** — the database of record: accounts, contacts, message
>   history, and encrypted access tokens.
> - **Cloudinary** — media attachments sent or received on a connected number,
>   stored so they remain viewable in the inbox after Meta expires the
>   original URL.
> - **Render** — hosting, and the queue that holds inbound messages between
>   arrival and processing.
> - **Anthropic PBC** — the text of an incoming message, and only when a
>   customer has switched on an AI auto-reply rule. It is sent to generate that
>   one reply and is not used to train models. No message reaches Anthropic
>   while AI replies are off.
>
> Meta is the delivery channel rather than a processor acting on our behalf.
> Webhook destinations that a customer registers are also not our processors:
> we deliver to a URL that customer chose, and from that point the data is
> governed by their policy.

Keep this list and the privacy policy in step. If a sub-processor is added or
removed in one, change the other in the same pass — they are two statements of
the same fact, and Meta reads both.

### The responsible entity

The previous submission answered **Sanju SK**. Check that against Business
Verification before repeating it: the privacy policy says "SanjuSK", the
verified business portfolio is "Sanju Sk Digital", and a later draft of the
form said "Sanju Ahuja". Meta cross-checks this field against the verification
documents, so the answer should be the name the business was **verified**
under, and the privacy policy should then be made to match. Four spellings of
the same organisation is the kind of small inconsistency that costs credibility
on a form whose whole purpose is establishing who you are.

Country: **India**.

### National-security requests and the processes behind them

**No** personal data has been provided to public authorities in response to
national-security requests. Re-check this rather than copying it forward — the
question asks about the past twelve months, so a true answer in July is not
automatically a true answer now.

The checkbox list that follows it asks which processes are *in place*. Answer
it from `docs/legal/PUBLIC_AUTHORITY_REQUESTS_POLICY.md`, which was written for
exactly these four options and maps them to its own sections in a table at the
end. With that policy adopted, all four are truthfully checkable:

- Required review of the legality of these requests
- Provisions for challenging these requests if they are considered unlawful
- Data minimization policy
- Documentation of these requests, including responses, legal reasoning and actors

**Adopting it is what makes them true.** Before ticking the boxes, confirm the
owner named in that policy's header knows they are the owner, that counsel
named in §4 has agreed, and that the register in §6 exists — empty is fine,
absent is not. A policy nobody has read is not a process in place, and the
previous submission checked only the first box, which was the honest answer at
the time.

## Before you submit

The deploy gate proves configuration, not readiness. Check these yourself:

1. Open a private browser window, go to the app URL, sign in with exactly the
   submitted credentials, and reach **Connect with Meta**. If you cannot,
   neither can the reviewer.
2. The URL you put in the Website field resolves, and the App Dashboard's
   webhook callback URL, JS SDK Allowed Domains and Valid OAuth Redirect URI
   all name that same origin. A mismatch fails Embedded Signup with a JSSDK
   host error before the reviewer sees anything.
3. The published Privacy Policy is publicly reachable and **true** — in
   particular, that the retention periods it states match what
   `RETENTION_MESSAGES_DAYS` / `RETENTION_AUDIT_LOG_DAYS` actually enforce.
   Meta's Data Use Checkup asks you to certify that document.
4. Business Verification shows Verified.
5. The full pre-submission walkthrough in `READINESS_STATUS.md` has been run
   end to end on the exact deployment being submitted.
