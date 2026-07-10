> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Privacy Policy

**Effective date:** [EFFECTIVE DATE]
**Last updated:** [LAST UPDATED DATE]

[COMPANY LEGAL NAME] ("**Metabsp**," "**we**," "**us**," or "**our**") operates a WhatsApp Business Platform (BSP) SaaS product built on Meta's WhatsApp Cloud API (the "**Service**"). This Privacy Policy explains what personal data we collect, how we use it, who we share it with, how long we keep it, and the rights available to you.

Metabsp is a multi-tenant platform: our direct customers are businesses ("**Business Customers**") who use the Service to communicate with their own end customers over WhatsApp ("**End Customers**" or "**Contacts**"). This Policy covers both (a) data we collect about Business Customers and their personnel, and (b) data Business Customers process about their own End Customers through the Service, for which Metabsp generally acts as a processor/service provider (see the [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md) for the controller/processor allocation).

## 1. Who this applies to

- **Business Customers** — the organizations (and their authorized users) who sign up for and administer the Service.
- **End Customers / Contacts** — the individuals a Business Customer communicates with over WhatsApp using the Service. Metabsp typically has no direct relationship with End Customers; their data reaches us because a Business Customer has connected a WhatsApp Business Account and messaged them.

## 2. Personal data we collect

### 2.1 Business Customer account data
- Name, email address, mobile number, and login credentials (passwords are hashed, never stored in plaintext).
- Organization/tenant details (business name and related metadata associated with the Business Customer's account).
- Role and permission assignments within the Business Customer's account.
- Billing and subscription data: plan selection, invoice records, and subscription status (see Section 4 — payment card data itself is handled by our payment processor, not stored by us).

### 2.2 WhatsApp Business Account (WABA) data
- WhatsApp Business Account ID and phone number ID(s) connected via Meta's Embedded Signup or manual connection flow.
- The WhatsApp access token issued by Meta for that account, which we store **encrypted at rest** (see Section 6).
- Business profile information the Business Customer configures (display name, category, etc.) as needed to operate the connected number.
- Connection/account status metadata (e.g., connected, disconnected, error, pending).

### 2.3 End Customer / Contact data (processed on behalf of Business Customers)
- Contact phone numbers, display names, and optional fields a Business Customer chooses to record: email, city, state, company, notes, tags, and custom fields.
- Message content and metadata exchanged between a Business Customer and its Contacts: message body/text, direction (inbound/outbound), delivery/read status, timestamps, and, for interactive or flow-based messages, the associated reply/flow identifiers and response data.
- Media attachments (images, documents, audio, video) sent or received via WhatsApp, which are stored with our media storage subprocessor (Section 5) and referenced by URL/media ID in message records.
- Conversation-state metadata used to enforce WhatsApp's 24-hour customer-service messaging window.

### 2.4 Technical and log data
- IP address and user agent, recorded for security/audit purposes (see Section 7) and for rate-limiting abusive traffic.
- API request metadata (endpoint, outcome) associated with API-key-authenticated integrations.
- Webhook event payloads delivered by Meta and, where a Business Customer configures outbound webhook destinations, the payloads and HMAC-signed requests we forward to those destinations.

We do not intentionally collect special categories of personal data (e.g., health, biometric, or similarly sensitive data) about End Customers; any such data that a Business Customer or its Contacts choose to include in message content is the Business Customer's responsibility to handle lawfully, consistent with the [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md) and [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md).

## 3. How we use personal data

- To provide the Service: sending/receiving WhatsApp messages on behalf of Business Customers, managing contacts, templates, automations, and connected WhatsApp Business Accounts.
- To authenticate users and enforce access control and rate limits.
- To operate billing and subscriptions (Section 4).
- To maintain security, detect abuse, and investigate incidents, including via the audit log described in Section 7.
- To provide customer support and respond to inquiries.
- To comply with legal obligations and enforce our [Terms of Service](./TERMS_OF_SERVICE.md) and [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md).
- Where enabled by a Business Customer, to power AI-assisted auto-reply features using message content (Section 5 — third-party AI subprocessor).

We do not sell personal data.

## 4. Payments

Subscription billing is processed through **Cashfree** (UPI Autopay / payment gateway). We store subscription and invoice records (plan, billing period, amounts, payment status, and an opaque gateway reference/customer ID) but do not store full payment card or bank account numbers ourselves — those are handled directly by Cashfree under its own privacy and security practices.

## 5. Subprocessors and third-party service providers

We use the following categories of subprocessors to operate the Service. Each subprocessor only receives the data necessary to perform its function.

| Subprocessor | Purpose | Data involved |
|---|---|---|
| **Meta Platforms, Inc. (WhatsApp Cloud API)** | Message transport/delivery, template management, webhook delivery | Message content, Contact phone numbers, WABA/account identifiers |
| **Cloudinary** | Hosting of media attachments (images, documents, audio, video) sent/received over WhatsApp | Media files and associated metadata |
| **Cashfree** | Payment processing / subscription billing (UPI Autopay) | Billing contact details, subscription/invoice amounts; card/bank data is held by Cashfree, not us |
| **Sentry** | Error tracking / application performance monitoring (optional; only active if configured) | Error/stack-trace data, which may incidentally include request metadata |
| **Anthropic** | AI-assisted auto-reply (optional; only used when a Business Customer configures an AI-assistant auto-reply rule) | The specific message content sent to the AI provider to generate an automated reply |

[COMPANY LEGAL NAME] may update this subprocessor list as the Service evolves. Business Customers with a signed [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md) are entitled to advance notice of new subprocessors per that agreement's terms.

## 6. Security measures

We apply technical and organizational measures appropriate to the sensitivity of the data we process, including:

- **Encryption of WhatsApp access tokens at rest**, using AES-256-GCM authenticated encryption (`backend/src/utils/crypto.js`), with support for zero-downtime key rotation (a current and previous encryption key can both be active during rotation).
- **Password hashing** — user passwords are never stored in plaintext.
- **JWT-based authentication**, verified against the current user record on every request rather than trusting claims alone.
- **HMAC-SHA256 signature verification** (timing-safe comparison) on inbound Meta webhooks, and HMAC-signed forwarding of webhook events to Business Customer–configured destinations.
- **Redis-backed rate limiting** on authenticated and unauthenticated endpoints to reduce brute-force and abuse risk.
- **Security headers** via `helmet` and an allow-listed CORS policy.
- **Audit logging** of security- and admin-relevant actions (user, tenant, action, resource, outcome, IP address, user agent, and timestamp) for traceability of access and changes.
- **Encrypted, access-controlled backups** (Section 7 of the [Data Retention Policy](./DATA_RETENTION_POLICY.md)), with encryption keys stored separately from database backups.

See the [Security Policy](./SECURITY_POLICY.md) for full detail.

## 7. Audit logging

Certain security- and administration-relevant actions are recorded in an internal audit log, capturing the acting user, the affected tenant, the action taken, the resource affected, whether it succeeded or failed, the requester's IP address and user agent, and a timestamp. This log exists to support security investigations, abuse detection, and accountability, and is accessible only to authorized personnel.

## 8. Data retention

See the [Data Retention Policy](./DATA_RETENTION_POLICY.md) for full detail, including how retention ties to our backup cadence. In summary:

- Production data (accounts, messages, contacts, automations, subscriptions/invoices, audit logs) lives in our primary database for as long as the relevant Business Customer account remains active, subject to that document's caveats.
- Database backups are retained on a **daily cadence for 14 days** and a **weekly cadence for 90 days**.
- **We do not currently run an automated process that deletes individual message or contact records after a fixed period of time.** Retention of live message/contact data is presently a matter of platform/operator policy rather than enforced code — see the Data Retention Policy for detail and next steps.

## 9. Your rights

Depending on your jurisdiction (e.g., GDPR for EU/EEA individuals, India's DPDP Act 2023 for individuals in India, or other applicable law), you may have rights to access, correct, export, or request deletion of your personal data, and to object to or restrict certain processing.

- **If you are an End Customer / Contact of one of our Business Customers**, the Business Customer is generally the controller of your data and the appropriate first point of contact for exercising these rights (e.g., opting out of messages, requesting deletion). We will assist Business Customers in responding to such requests as described in our [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md).
- **If you are a Business Customer or a member of a Business Customer's team**, you may contact us directly using the details in Section 12.

**Honesty note:** as of this template's drafting, the Service does not expose a self-service "export my data" or "delete my account" API/UI flow. Requests are currently handled manually by our support/operations team. See the [GDPR Compliance Checklist](./GDPR_COMPLIANCE_CHECKLIST.md) and [DPDP Compliance Checklist](./DPDP_COMPLIANCE_CHECKLIST.md) for the current state of automation and any operator commitments to build it.

## 10. International data transfers

[This Service's infrastructure is hosted in [HOSTING REGION/JURISDICTION]. Personal data may be transferred to and processed in countries other than the one in which you reside, including countries that may not have data protection laws equivalent to those in your jurisdiction. Where required, we rely on [TRANSFER MECHANISM, e.g., Standard Contractual Clauses / adequacy decision / other lawful transfer mechanism — COMPANY TO SPECIFY] to safeguard such transfers.]

## 11. Children's data

The Service is intended for business use and is not directed at individuals under the age of [MINIMUM AGE, e.g., 18]. We do not knowingly collect personal data from children through the Service's own account-creation flow; End Customer message content is the responsibility of the Business Customer sending it.

## 12. Contact us / Data Protection Officer

For privacy inquiries, data subject requests, or questions about this Policy, contact:

- **Data Protection Officer / Privacy contact:** [DPO CONTACT EMAIL]
- **Postal address:** [COMPANY REGISTERED ADDRESS]

## 13. Changes to this Policy

We may update this Privacy Policy from time to time. Material changes will be notified via [NOTIFICATION METHOD — e.g., email to account administrators and/or an in-app notice] and by updating the "Last updated" date above.
