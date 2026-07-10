# System User token creation

Meta's own guidance for Tech Providers/BSPs is to authenticate using a
**Business-owned System User token** rather than a token tied to one
admin's personal Facebook login. A personal-login token breaks (and every
customer number using it goes down) the moment that one employee changes
their password, leaves the company, or has their account restricted —
a System User belongs to the Business itself.

## There is no API for this — it's a one-time manual step per Business

Meta does not expose an endpoint to programmatically create a System User
token; the Business owner generates it once in Meta Business Manager:

1. **Business Settings → Users → System Users → Add**. Create a System
   User with the **Admin** role (needed to manage WhatsApp assets).
2. **Assign assets**: add the relevant WhatsApp Business Account(s) to
   this System User with **Full Control**.
3. **Generate token**: System User → Generate New Token → select the app
   (the same one whose `META_APP_ID`/`META_APP_SECRET` this backend uses)
   → select permissions `whatsapp_business_management` and
   `whatsapp_business_messaging` → choose **Never** for token expiration.
4. Copy the generated token — Meta shows it once.

## Using it in this app

`PUT /api/whatsapp/account/:id/system-user-token` (`setSystemUserToken` in
`backend/src/controllers/whatsappController.js`) accepts `{accessToken, systemUserId}`,
verifies the token actually works against the connected phone number
(`checkWhatsAppHealth`) before storing it, encrypts it the same way as any
other token, sets `tokenSource: 'system_user'` on the `WhatsAppAccount`
document, and clears `tokenExpiresAt` (System User tokens set to "never
expire" don't have a numeric expiry to track).

In the UI: **WhatsApp Attendance Settings → Connected WhatsApp numbers →
System User token** button per connected number
(`frontend/src/Components/whatsappCloud/WhatsAppNumbersPanel.jsx`) opens a
form to paste the token; a "System User token" chip marks accounts using
one.

## Why `tokenSource` matters operationally

`backend/src/services/tokenRefreshService.js`'s daily scheduler explicitly
excludes `tokenSource: 'system_user'` accounts from its re-exchange cycle
— `fb_exchange_token` isn't the documented refresh path for System User
tokens, and running it against one risks invalidating a working token
instead of extending it.

## Recommendation

Set every production WhatsApp number to use a System User token before
scaling past a handful of customers. It's the only token type this app
supports that isn't tied to an individual person's Meta account staying
active and in good standing.
