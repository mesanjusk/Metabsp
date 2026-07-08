> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# DPDP Act 2023 Compliance Checklist

**Assessment date:** [ASSESSMENT DATE]

This checklist reviews Metabsp's posture against India's Digital Personal Data Protection Act, 2023 ("**DPDP Act**"), honestly cross-referenced against the actual codebase. Each item is marked:

- **Implemented** — a real, verifiable mechanism exists (file/feature cited).
- **Partially implemented** — a mechanism exists but has gaps (e.g., a policy document exists but no automated enforcement, or a UI exists but no backend audit trail).
- **Not yet implemented — requires operator action** — no mechanism currently exists in the code; this is a genuine gap.

Nothing here is marked "Implemented" without a corresponding real mechanism cited.

## 1. Notice requirements (Section 5)

| Item | Status | Basis |
|---|---|---|
| Clear notice of what personal data is collected and for what purpose | **Partially implemented** | This template's [Privacy Policy](./PRIVACY_POLICY.md) describes actual data flows; it must be finalized (placeholders completed) and published/served to users before it satisfies Section 5 notice requirements. |
| Notice in itemised, understandable form, including in English and [REGIONAL LANGUAGE, if required] | **Not yet implemented — requires operator action** | No multi-language notice currently exists; operator must decide language requirements and translate. |
| Notice provided at or before the point of data collection (e.g., signup) | **Not yet implemented — requires operator action** | No in-app notice/consent capture step at signup was found wired to this Privacy Policy; the existing UI consent banner (`frontend/src/components/WhatsAppConsentBanner.jsx`) is informational and dismissible via `localStorage`, not a recorded notice-acknowledgement event. |

## 2. Consent management (Sections 6–7)

| Item | Status | Basis |
|---|---|---|
| Free, specific, informed, unconditional, and unambiguous consent for processing personal data | **Not yet implemented — requires operator action** | No backend consent-capture/versioning mechanism (e.g., a `ConsentRecord` with timestamp, policy version, and user ID) was found. The frontend consent banner only stores a dismissal flag locally in the browser, not an auditable server-side consent record. |
| Easy mechanism to withdraw consent | **Not yet implemented — requires operator action** | No withdrawal/consent-management UI or API tied to a stored consent record exists. |
| Consent Manager registration/interoperability (if applicable to Metabsp's role) | **Not yet implemented — requires operator action** | Not applicable unless Metabsp registers as a Consent Manager; operator to assess applicability. |
| End-customer opt-in for WhatsApp messaging | **Partially implemented (by policy, not enforcement)** | The [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md) requires Business Customers to obtain opt-in consent before messaging contacts, consistent with Meta's own WhatsApp policy, but the platform does not technically verify or enforce that a given Contact has actually opted in before a message can be sent — this is a contractual obligation on the Business Customer, not a system control. |

## 3. Data fiduciary obligations (Sections 8–9)

| Item | Status | Basis |
|---|---|---|
| Reasonable security safeguards against breach | **Implemented** | AES-256-GCM encryption of WhatsApp access tokens with key rotation (`backend/src/utils/crypto.js`); JWT auth re-verified per request; HMAC-SHA256 timing-safe webhook signature verification; Redis-backed rate limiting; `helmet` security headers; CORS allow-listing. See the [Security Policy](./SECURITY_POLICY.md). |
| Accountability for processor's processing of personal data | **Partially implemented** | Sub-processors are identified in the [Privacy Policy](./PRIVACY_POLICY.md) and [DPA](./DATA_PROCESSING_AGREEMENT.md) (Meta, Cloudinary, Cashfree, Sentry, Anthropic), but contractual DPAs with each of these vendors need to be confirmed/executed by the operator; this repo does not contain those vendor-side agreements. |
| Purpose limitation — data used only for notified/consented purposes | **Partially implemented** | Described at a policy level in the Privacy Policy; not technically enforced (e.g., there is no automated check preventing message content from being repurposed beyond messaging/support/security use). |
| Data accuracy and completeness where used for decisions affecting the data principal | **Not yet implemented — requires operator action** | No automated data-quality/correction workflow exists beyond a Business Customer manually editing a contact record. |
| Erasure of personal data once purpose is served / consent withdrawn, absent a legal retention requirement | **Not yet implemented — requires operator action** | As documented in the [Data Retention Policy](./DATA_RETENTION_POLICY.md), there is no automated job that erases message or contact data once its purpose is served; retention today is indefinite while an account is active. This is the most significant DPDP gap identified in this review. |
| Grievance redressal mechanism with a published timeframe | **Not yet implemented — requires operator action** | No dedicated grievance-officer contact or grievance-tracking mechanism currently exists; only a general privacy contact placeholder is provided in the Privacy Policy. |

## 4. Data principal rights (Section 11–14)

| Right | Status | Basis |
|---|---|---|
| Right to access a summary of personal data processed | **Not yet implemented — requires operator action** | No self-service "view/export my data" endpoint exists in `backend/src/routes/` or `backend/bulk/routes/`; would need to be handled manually per the process described in the [Data Retention Policy](./DATA_RETENTION_POLICY.md). |
| Right to correction and completion of personal data | **Partially implemented** | Business Customers can edit their own account/contact records through existing CRUD functionality (e.g., contact management), which covers correction of data a Business Customer controls; there is no dedicated data-principal-initiated correction request flow for End Customers. |
| Right to erasure | **Not yet implemented — requires operator action** | No self-service or admin-triggered "erase this data principal's data" endpoint exists; would be a manual process today. |
| Right of grievance redressal | **Not yet implemented — requires operator action** | See Section 3 above — no dedicated grievance officer/process yet designated. |
| Right to nominate (in case of death/incapacity) | **Not yet implemented — requires operator action** | No such mechanism exists; low priority for a B2B messaging platform but should be assessed by counsel. |

## 5. Cross-border transfer conditions (Section 16)

| Item | Status | Basis |
|---|---|---|
| Transfers only to jurisdictions not restricted by the Central Government | **Not yet implemented — requires operator action** | Placeholder only; the [Privacy Policy](./PRIVACY_POLICY.md)'s international transfers section and hosting/jurisdiction details must be completed by the operator, and checked against any government-notified restricted-country list at time of publishing. |
| Disclosure of hosting/processing locations to Business Customers | **Partially implemented** | Sub-processors are named in the Privacy Policy/DPA, but their specific data-hosting geographies are left as placeholders pending operator input. |

## 6. Breach notification (Section 8(6) and related rules)

| Item | Status | Basis |
|---|---|---|
| Notification to affected data principals on breach | **Not yet implemented — requires operator action** | No automated breach-detection-to-notification pipeline exists; the [Security Policy](./SECURITY_POLICY.md) and [DPA](./DATA_PROCESSING_AGREEMENT.md) commit to notifying affected Business Customers, but the mechanism is manual/operational, not code-enforced. |
| Notification to the Data Protection Board of India | **Not yet implemented — requires operator action** | No such notification workflow exists; this must be an operational/legal runbook item, since the Board did not exist as a coded integration target. |
| Internal breach-detection capability | **Partially implemented** | Audit logging (`AuditLog` model, `auditLogService.js`) and optional Sentry error tracking provide raw signal that could support detecting anomalous access, but there is no automated alerting/classification system that flags an event as a reportable "personal data breach." |

## 7. Significant Data Fiduciary (SDF) obligations (Section 10), if designated

| Item | Status | Basis |
|---|---|---|
| Appointment of a Data Protection Officer based in India | **Not yet implemented — requires operator action** | Placeholder contact only ([DPO CONTACT EMAIL]); operator must determine if Metabsp will be notified as an SDF and appoint accordingly. |
| Independent data auditor / periodic audits | **Not yet implemented — requires operator action** | No such audit program exists today. |
| Data Protection Impact Assessment (DPIA) | **Not yet implemented — requires operator action** | No DPIA has been conducted; given the volume of message/contact data processed on behalf of Business Customers, the operator should assess whether an SDF designation (and its DPIA obligation) is likely. |

## 8. Summary of the most material gaps

1. **No automated erasure/retention-expiry mechanism** for message or contact data (Sections 3, 4).
2. **No self-service data principal access/erasure flow** (Section 4) — currently manual only.
3. **No server-side, auditable consent record** for the platform's own processing (Section 2) — only a dismissible UI banner.
4. **No dedicated grievance officer/redressal process** (Sections 3, 4).
5. **No breach-to-Data-Protection-Board notification workflow** (Section 6).

These are flagged honestly rather than glossed over; addressing them is an operator decision and, in most cases, a development task in addition to a policy one.
