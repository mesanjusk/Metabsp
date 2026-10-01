# MetaBSP RCS for Business setup

MetaBSP now includes a Google RCS for Business channel at `/services/rcs`.

## What is implemented

- Per-workspace RCS agent configuration (agent ID, region, use case and fallback rule)
- Google service-account OAuth without storing the private key in MongoDB
- Asia Pacific, Europe and North America regional RBM endpoints
- E.164 device capability checking
- Direct RCS text sending with `messageTrafficType`
- RCS campaigns for up to 100 opted-in recipients per request
- Signed webhook verification with `X-Goog-Signature`
- Incoming message/event storage
- Delivery/read status updates
- SUBSCRIBE/UNSUBSCRIBE suppression
- Automatic WhatsApp fallback only when the existing 24-hour customer-service window allows free-form text
- Optional generic SMS-adapter fallback

## Required Render environment variables

### RCS_SERVICE_ACCOUNT_JSON_BASE64

Create a service-account key from the RCS for Business partner account. Base64-encode the complete downloaded JSON file and store the encoded string in Render.

The raw private key is never exposed to the browser and is never stored in MongoDB.

### RCS_WEBHOOK_CLIENT_TOKEN

Create a long random token. Put the same value in Render and in the RCS for Business webhook configuration.

Set the webhook URL to:

```
https://YOUR_PUBLIC_DOMAIN/api/rcs/webhook
```

### Optional SMS fallback

If you select SMS fallback, configure:

```
RCS_SMS_FALLBACK_URL=https://your-sms-adapter.example/send
RCS_SMS_FALLBACK_TOKEN=optional-bearer-token
```

The adapter receives:

```json
{
  "to": "+919876543210",
  "text": "message body",
  "source": "rcs-fallback"
}
```

## Google-side setup

1. Register/obtain approval as an RCS for Business partner.
2. Create the brand and RCS agent in the RCS for Business Developer Console.
3. For India, choose Asia Pacific when that is the appropriate hosting region for the agent.
4. Create/download the partner service-account key.
5. Configure the signed partner or agent webhook using MetaBSP's `/api/rcs/webhook` URL and the same client token used in Render.
6. Add your Android phone as a tester while the agent is unlaunched.
7. Complete brand verification and launch approval before sending to non-test users.
8. Copy the Agent ID into MetaBSP → RCS Messaging and save the correct hosting region/use case.
9. Run the capability checker, then send a direct test message.
10. Only run campaigns to recipients with valid opt-in.

## Fallback behavior

- RCS reachable: MetaBSP sends RCS.
- RCS unreachable + WhatsApp fallback: MetaBSP sends free-form WhatsApp only if the recipient is inside the existing 24-hour service window. Otherwise it returns `WHATSAPP_TEMPLATE_REQUIRED` and does not bypass Meta policy.
- RCS unreachable + SMS fallback: MetaBSP calls the configured SMS adapter.
- No fallback: no alternate message is sent.

For time-sensitive messages, delivery receipt/TTL based fallback should be added before using fallback as a guaranteed-delivery mechanism; this initial implementation only falls back when the capability check says the recipient is not RCS-reachable.
