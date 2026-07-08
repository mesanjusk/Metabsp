# Legal Document Templates

> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

This directory contains legal document **templates** for the operating company running Metabsp (a WhatsApp Business Platform / BSP SaaS built on Meta's WhatsApp Cloud API). They are written to be grounded in what this specific codebase actually does — encryption mechanisms, audit logging, backup retention, middleware, and third-party integrations are cited by file path where relevant — rather than generic boilerplate. Every document still requires attorney review, jurisdiction-specific legal input, and completion of bracketed placeholders (company legal name, registered address, governing law, effective dates, DPO contact, etc.) before it is fit to publish to customers or end users.

These are templates for the **company operating Metabsp**, not for its business customers — though a customer's own counsel may find the DPA and compliance checklists useful as a starting point for their own obligations under Meta's Business Terms.

## Index

| Document | Description |
|---|---|
| [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) | What personal data the platform collects/processes (including on behalf of business customers), how it's used, subprocessors, retention, security, and user rights. |
| [`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md) | Core contract governing use of the platform: service description, account/API responsibilities, billing, Meta policy compliance, availability, termination, liability. |
| [`DATA_PROCESSING_AGREEMENT.md`](./DATA_PROCESSING_AGREEMENT.md) | DPA for business customers (data controllers) covering Metabsp's role as processor, subject matter/duration of processing, subprocessors, security, breach notification, and data return/deletion on termination. |
| [`DATA_RETENTION_POLICY.md`](./DATA_RETENTION_POLICY.md) | How long different categories of data are kept, tied to the real backup cadence (daily/14-day, weekly/90-day), and an honest statement of what is/isn't automatically deleted today. |
| [`COOKIE_POLICY.md`](./COOKIE_POLICY.md) | Cookie/local-storage usage on the web frontend, based on what the frontend code actually sets. |
| [`SECURITY_POLICY.md`](./SECURITY_POLICY.md) | Technical and organizational security measures: token encryption, auth, webhook signature verification, rate limiting, audit logging, and responsible disclosure. |
| [`ACCEPTABLE_USE_POLICY.md`](./ACCEPTABLE_USE_POLICY.md) | Prohibited uses specific to operating a WhatsApp BSP, consequences of violation, and abuse reporting. |
| [`DPDP_COMPLIANCE_CHECKLIST.md`](./DPDP_COMPLIANCE_CHECKLIST.md) | Honest, item-by-item checklist against India's Digital Personal Data Protection Act, 2023. |
| [`GDPR_COMPLIANCE_CHECKLIST.md`](./GDPR_COMPLIANCE_CHECKLIST.md) | Honest, item-by-item checklist against the EU General Data Protection Regulation. |

## How these were grounded

Facts cited in these documents were cross-referenced against the actual codebase as of the date these templates were drafted, including: `backend/src/utils/crypto.js` (AES-256-GCM token encryption and key rotation), `backend/src/models/AuditLog.js` and `backend/src/services/auditLogService.js` (audit event fields), `docs/BACKUP_RESTORE.md` (backup cadence/retention), `backend/src/middleware/` (auth, rate limiting, webhook signature verification), `backend/src/app.js` (helmet, CORS), `backend/.env.example` (subprocessor integrations), and the `backend/src/models/` and `backend/src/repositories/` schemas (what personal/business data is actually stored). Where a compliance mechanism (e.g., a self-service data export or erasure API) does not currently exist in the code, the relevant document says so plainly rather than implying it exists — see the checklists for the full list of gaps.
