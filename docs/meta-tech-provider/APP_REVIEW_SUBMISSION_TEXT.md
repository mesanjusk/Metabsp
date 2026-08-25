# App Review — submission text, ready to paste

Copy each block into the matching field in the Meta App Dashboard. These
replace the text submitted on 2026-07-13, which was rejected-prone for four
reasons, all fixed here:

1. `[Your Name]` was left in two justifications — an unmistakable sign to a
   reviewer that a template was pasted unread.
2. `public_profile`'s usage field was blank.
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
> connect its own WhatsApp Business Account and manage customer conversations
> from a shared team inbox.
>
> We use `whatsapp_business_messaging` to send and receive messages on behalf
> of the business that has connected its own WABA through Meta's Embedded
> Signup flow. Specifically:
>
> - Sending text, media, and pre-approved template messages that the connected
>   business composes or schedules in our dashboard.
> - Receiving inbound customer messages and delivery/read statuses through our
>   webhook endpoint, so the business can reply from the shared inbox.
> - Uploading and retrieving media attached to those messages.
>
> All messaging is initiated either by the business's own staff or by a
> customer messaging that business first. We enforce Meta's 24-hour customer
> service window in code: outside it, only approved template messages can be
> sent. We never message a person who has not contacted the connected
> business or opted in through it.
>
> We do not use this permission for any purpose beyond operating the connected
> business's own conversations, and we do not share message content between
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

## `public_profile` → "Tell us how you're using this permission"

> We call `/me` once, during Embedded Signup and manual connect, to identify
> the Meta user completing the connection and associate that connection with
> the correct account in our platform.
>
> We store only the app-scoped user ID. We do not store, display, or share the
> user's name, profile picture, or any other profile field, and we do not use
> this data for advertising, analytics, or profiling.

---

## Web reviewer instructions

**This is the field that matters most.** Fill the bracketed values in with a
real, working account before submitting, and test it yourself in a private
browser window first.

> The WhatsApp features in this app are behind a login, so credentials are
> required. Please use the reviewer account below — self-registration is not
> possible, because signup requires a one-time code delivered over WhatsApp.
>
> Application URL: [YOUR APP URL]
> Mobile / Username: [REVIEWER LOGIN]
> Password: [REVIEWER PASSWORD]
>
> Note: the login form's first field is labelled "Mobile / Username" and
> expects the value above — it is not an email address.
>
> Steps to review each requested permission:
>
> 1. Sign in with the credentials above.
> 2. Open "WhatsApp" from the left sidebar.
> 3. Click "Connect with Meta" to launch Meta's Embedded Signup popup. Signing
>    in with a Facebook account that has a WhatsApp Business Account and
>    granting the requested permissions demonstrates `public_profile` and
>    `business_management`. (`whatsapp_business_management` is exercised here
>    too: on completion the app reads the phone number's details and subscribes
>    itself to the WABA's webhooks.)
> 4. Open the "Templates" tab to see template listing and creation
>    (`whatsapp_business_management`).
> 5. Open the "Chats" tab and send a message to a number that has messaged the
>    business (`whatsapp_business_messaging`). Inbound messages and delivery
>    statuses appear in the same view as they arrive over our webhook.
> 6. A supporting walkthrough, including this same flow, is at
>    [YOUR APP URL]/meta-app-review.
>
> If the reviewer account stops working at any point, please contact
> [YOUR REVIEW CONTACT EMAIL] and we will restore access immediately.

### Creating the reviewer account

Nothing in this repository seeds one. Because signup requires a WhatsApp OTP,
create it directly:

- Sign up through the normal flow using a mobile number you control and can
  receive WhatsApp on, then set a known password; **or**
- Insert the user directly in MongoDB with a bcrypt-hashed password, matching
  the `username` / `mobile` / `password` shape in `backend/bulk/models/User.js`.

Then set `VITE_REVIEWER_LOGIN`, `VITE_REVIEWER_PASSWORD` and
`VITE_PUBLIC_APP_URL` in Vercel so `/meta-app-review` shows the same values.
They are read from the environment rather than committed, because this
repository is public and a working login in git is a credential leak.

**Verify before submitting**: open a private browser window, go to the app URL,
sign in with exactly those credentials, and reach the "Connect with Meta"
button. If you cannot, neither can the reviewer.
