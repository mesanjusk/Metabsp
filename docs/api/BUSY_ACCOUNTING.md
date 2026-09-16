# BUSY Accounting connector

Open **Developers → BUSY Accounting** on the dashboard. Each customer signs in
with their own account, chooses an accessible WhatsApp number, and creates a
BUSY integration. Copy the one-time token and the generated API URL into BUSY.
No Meta access token or administrator credential is given to BUSY.

## BUSY configuration

The generated URL has substitution placeholders, not a live secret:

```text
https://meta.sanjusk.in/api/integrations/busy/send?token=BUSY_TOKEN&phone=BUSY_MOBILE&message=BUSY_MESSAGE
```

| BUSY field | Parameter Name | Parameter Value |
| --- | --- | --- |
| User Name | BUSY_TOKEN | The generated `busy_…` token |
| Password | unused | Leave blank |
| Senders ID | unused | Leave blank; sender is pinned in the dashboard |
| Mobile | BUSY_MOBILE | Picked by BUSY at send time |
| Message | BUSY_MESSAGE | Picked by BUSY at send time |

Names are case-sensitive. Select **Leave as it is** for mobile treatment and
**Separate Internal Call for Each Number During Bulk SMS**. The connector accepts
one recipient per request. If enabled in the dashboard, exactly 10 digits receive
India's `91` prefix; otherwise supply the international number with country code.

BUSY must URL-encode substituted values. In particular `&`, `+`, `%`, Hindi text,
newlines and URLs containing their own query strings must be encoded. Do not
paste a completed sending URL into a browser: GET performs the send.

When template variables use Other parameters, the generated URL includes
`param1=BUSY_PARAM1`, `param2=BUSY_PARAM2`, or `param3=BUSY_PARAM3`. Copy the dashboard's
mapping table, set the displayed number of Other Parameters and supply their
values in BUSY. Enable runtime changes for fields that vary. The connector does
not parse invoice amounts or customer names out of arbitrary message text.

## Messages and invoices

- **Approved template** is the default. Select an existing approved template for
  the chosen sender's WABA, and map its header/body variables to the BUSY message,
  the invoice link, or up to three extra parameters. Template name, language and
  mappings are fixed when the token is created. The send URL cannot override them.
- **Text** is for replies within 24 hours of the recipient's last message only.
  Requests outside that window fail explicitly; they are not silently turned into
  an unrelated template. In text mode a PDF link remains a link in the message.
- For PDF invoices, enable BUSY's **Send PDF link for Invoice**. When a mapping uses
  Invoice PDF link, the connector reads the first HTTPS URL in the message (or an
  explicitly supplied `invoice_url`). It must be reachable by Meta without login.
  A DOCUMENT header sends that URL as a document named Invoice.pdf; a text variable
  sends the URL as text. This connector does not upload local files or create PDFs.
- Supported templates have text body/header variables, an optional DOCUMENT header,
  a footer, and static URL/phone buttons. Named and positional variables are supported.
  Image/video headers, quick replies, dynamic URL buttons and special components
  are rejected during setup with an explanation. Template text variables have
  whitespace collapsed; ordinary text messages retain their original whitespace.

Save the format in BUSY and test with a consenting recipient such as your own
phone. Verify acceptance and subsequent delivery in the dashboard inbox.
The exact installed BUSY version's substitution, encoding and response handling
must be verified from that client; server tests do not substitute for this step.

## Isolation and retry behaviour

The token is hashed at rest and shown once. It is send-only, pinned to one account,
and cannot authenticate `/api/v1/*` or read messages. General `mbsp_` API keys are
not accepted in this URL. Other customers' numbers, inactive/deleted owners,
disconnected senders and revoked tokens are rejected. Revocation is available in
the BUSY tab and uses the existing owner-scoped API-key revocation endpoint.

Query credentials may appear in client/proxy/access logs. Keep the token and the
completed URL private, restrict log access, and redact `token` at proxies you manage.
A separate token per company limits the impact and can be revoked independently.
The connector itself does not log incoming URLs or tokens. Responses are no-store,
HEAD never sends, and requests identified as link prefetch/preview are rejected.

The limit is 60 requests/minute per token, plus an IP limit. Redis reserves a
fingerprint before sending. Identical sends within two minutes return the earlier
acceptance ID or a 409 if the first result is still uncertain. This is a bounded
retry guard, not permanent invoice deduplication. A Redis failure stops a new send.
After a provider timeout, check the inbox before retrying; delivery may have occurred.

A successful response means Meta accepted the request, not that the recipient has
received it. Delivery/read/failure status continues through existing WhatsApp
webhooks and inbox records. No real messages are sent by the automated tests.
