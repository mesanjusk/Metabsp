> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Data Processing Agreement (DPA)

**Effective date:** [EFFECTIVE DATE]

This Data Processing Agreement ("**DPA**") forms part of the agreement between [COMPANY LEGAL NAME] ("**Metabsp**," "**Processor**") and the business customer identified in the applicable order form ("**Customer**," "**Controller**") governing Metabsp's processing of personal data on Customer's behalf through the Service, as defined in the [Terms of Service](./TERMS_OF_SERVICE.md).

## 1. Roles of the parties

- **Customer** is, in respect of personal data relating to its own end customers/contacts ("**End Customer Data**"), the **data controller** (or "data fiduciary" under India's DPDP Act). Customer determines why and how End Customer Data is collected and messaged (e.g., obtaining opt-in consent, deciding message content and cadence).
- **Metabsp** is the **data processor** (or "data processor" under the DPDP Act) with respect to End Customer Data, acting only on Customer's documented instructions as communicated through the Service's configuration and features, except where otherwise required by applicable law.
- **Meta Platforms, Inc.** is a **sub-processor** engaged by Metabsp for the underlying WhatsApp Cloud API messaging transport, template management, and webhook delivery. Meta processes messaging data under its own terms (Meta's WhatsApp Business Platform terms, Business Terms, and privacy policies), which apply independently of this DPA.
- With respect to Metabsp's own account, billing, and administrative data about Customer and Customer's personnel, Metabsp acts as an independent controller — see the [Privacy Policy](./PRIVACY_POLICY.md).

## 2. Subject matter, duration, and nature of processing

- **Subject matter:** provision of the WhatsApp BSP Service, including sending/receiving WhatsApp messages, storing contacts and message history, managing templates and automations, and forwarding webhook events, on Customer's behalf.
- **Duration:** for as long as Customer's account with Metabsp remains active, plus any post-termination retention period described in Section 9 and the [Data Retention Policy](./DATA_RETENTION_POLICY.md).
- **Nature and purpose of processing:** storage, transmission, and display of End Customer Data to enable Customer's WhatsApp messaging operations; automated processing where Customer configures features such as auto-reply rules or AI-assisted responses.
- **Categories of data subjects:** Customer's end customers/contacts who are messaged via a Customer-connected WhatsApp Business Account; Customer's own personnel who use the Service.
- **Categories of personal data:** as described in Section 2 of the [Privacy Policy](./PRIVACY_POLICY.md) — contact phone numbers and optional profile fields, message content and metadata, media attachments, delivery/read status, and technical/audit log data.

## 3. Customer instructions

Metabsp will process End Customer Data only to provide the Service in accordance with Customer's configuration of it (e.g., which numbers to message, what automations to run) and Customer's documented instructions, except where processing is required by applicable law, in which case Metabsp will inform Customer of that legal requirement before processing, unless prohibited from doing so.

## 4. Sub-processors

Customer authorizes Metabsp's use of the following sub-processors in connection with the Service:

| Sub-processor | Function |
|---|---|
| **Meta Platforms, Inc.** | WhatsApp Cloud API messaging transport, template management, webhook source |
| **Cloudinary** | Storage/hosting of media attachments sent or received via WhatsApp |
| **Cashfree** | Payment processing for Customer's subscription billing (does not process End Customer Data) |
| **Sentry** | Error tracking / application performance monitoring (optional; incidental exposure to request metadata only) |
| **Anthropic** | AI-assisted auto-reply generation (optional; only where Customer configures an AI-assistant auto-reply rule, and only for the message content sent to generate that reply) |

Metabsp will provide Customer with [NOTICE PERIOD, e.g., 30 days'] advance notice of the addition or replacement of a sub-processor materially involved in processing End Customer Data (via [NOTIFICATION MECHANISM — e.g., email or an in-app notice / update to this document]), and Customer may object on reasonable data-protection grounds as further described in [OBJECTION PROCESS — COMPANY TO SPECIFY].

## 5. Security measures

Metabsp implements the following technical and organizational measures with respect to End Customer Data:

- **Encryption at rest of WhatsApp access tokens** using AES-256-GCM authenticated encryption, with a key-rotation mechanism supporting a current and previous encryption key so tokens can be re-encrypted without downtime (`backend/src/utils/crypto.js`).
- **Access control** via JWT-based authentication re-verified against the live user record on each request, and role/permission-scoped authorization.
- **Webhook authenticity** — inbound Meta webhooks are verified using an HMAC-SHA256 signature check with a timing-safe comparison, rejecting unverifiable payloads; outbound webhook forwarding to Customer-configured destinations is itself HMAC-signed so Customer can verify authenticity.
- **Rate limiting** backed by Redis to reduce brute-force and abuse risk across both authenticated and unauthenticated endpoints.
- **Security headers and CORS allow-listing** at the application layer.
- **Audit logging** of security- and administration-relevant actions, capturing acting user, tenant, action, resource, outcome, IP address, user agent, and timestamp, to support incident investigation and accountability.
- **Encrypted, access-restricted backups**, described further in Section 9 and the [Data Retention Policy](./DATA_RETENTION_POLICY.md), with encryption keys stored separately from database backup archives.

Full detail is in the [Security Policy](./SECURITY_POLICY.md).

## 6. Confidentiality

Metabsp ensures that personnel authorized to process End Customer Data are subject to confidentiality obligations.

## 7. Assistance with data subject requests

Metabsp will provide reasonable assistance to Customer in responding to data subject (or "data principal," under the DPDP Act) requests relating to End Customer Data — including access, correction, and erasure requests — to the extent Customer cannot reasonably fulfill such a request using the Service's own functionality.

**Honesty note:** as of this template's drafting, the Service does not provide an automated, self-service API or UI for exporting or erasing an individual End Customer's data. Such requests must currently be handled as a manual operational process between Customer and Metabsp support. This is tracked as a gap in the [GDPR Compliance Checklist](./GDPR_COMPLIANCE_CHECKLIST.md) and [DPDP Compliance Checklist](./DPDP_COMPLIANCE_CHECKLIST.md); Customer and Metabsp should agree on an interim manual process (e.g., a documented support ticket workflow) until automated tooling exists, if required.

## 8. Personal data breach notification

Metabsp will notify Customer without undue delay after becoming aware of a personal data breach affecting End Customer Data, providing available information about the nature of the breach, the categories and approximate number of data subjects/records affected, and the measures taken or proposed to address it, to support Customer's own breach-notification obligations under applicable law (e.g., the 72-hour notification expectation under GDPR Art. 33, or notification to India's Data Protection Board under the DPDP Act). [SPECIFIC NOTIFICATION TIMEFRAME COMMITMENT, e.g., "within 48 hours of confirming a breach" — COMPANY TO SPECIFY]

## 9. Data return and deletion on termination

On termination or expiration of Customer's agreement with Metabsp:

- Customer may request export of its End Customer Data in a reasonable format within [EXPORT REQUEST WINDOW — COMPANY TO SPECIFY] of termination. **Honesty note:** this export is not currently a self-service, automated feature of the Service and would be fulfilled as a manual operational request.
- Following any such export window (or immediately if no export is requested), Metabsp will delete or anonymize End Customer Data from its production systems within [DELETION WINDOW — COMPANY TO SPECIFY].
- Because production data is protected by periodic database backups, residual copies of deleted data may persist in backup archives until those backups age out under our standard cadence — **daily backups retained for 14 days, weekly backups retained for 90 days** (see `docs/BACKUP_RESTORE.md` and the [Data Retention Policy](./DATA_RETENTION_POLICY.md)). Metabsp does not selectively purge individual records from existing backup archives; deletion from backups occurs naturally as each archive's retention period expires.
- Encryption keys used to protect WhatsApp access tokens (and other secrets) are retained separately from database backups per our operational runbook and are rotated/retired according to our internal key-management practice, not on a per-customer basis.

## 10. Audit rights

Upon reasonable prior notice and no more than [AUDIT FREQUENCY, e.g., once per 12 months] (except where required by a supervisory authority or following a suspected breach), Metabsp will make available information reasonably necessary to demonstrate compliance with this DPA, which may include responding to a written questionnaire, providing a summary of relevant security documentation, or — where mutually agreed — a third-party audit report in lieu of a direct on-site audit. [FULL AUDIT MECHANISM — COMPANY/COUNSEL TO SPECIFY]

## 11. International transfers

Where processing of End Customer Data involves a transfer across borders, the parties will rely on [TRANSFER MECHANISM — e.g., Standard Contractual Clauses, an adequacy decision, or another lawful transfer mechanism — COMPANY TO SPECIFY], consistent with the [Privacy Policy](./PRIVACY_POLICY.md)'s international transfers section.

## 12. Precedence

In the event of a conflict between this DPA and the [Terms of Service](./TERMS_OF_SERVICE.md) regarding the processing of personal data, this DPA controls.

## 13. Contact

Data protection inquiries under this DPA should be directed to [DPO CONTACT EMAIL].
