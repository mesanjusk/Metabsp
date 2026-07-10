> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# GDPR Compliance Checklist

**Assessment date:** [ASSESSMENT DATE]

This checklist reviews Metabsp's posture against the EU General Data Protection Regulation ("**GDPR**"), honestly cross-referenced against the actual codebase. Each item is marked:

- **Implemented** — a real, verifiable mechanism exists (file/feature cited).
- **Partially implemented** — a mechanism exists but has gaps.
- **Not yet implemented — requires operator action** — no mechanism currently exists in the code; this is a genuine gap.

## 1. Lawful basis for processing (Art. 6)

| Item | Status | Basis |
|---|---|---|
| Lawful basis identified for Business Customer account data | **Partially implemented** | Processing is necessary to perform the contract with the Business Customer (Art. 6(1)(b)) — implicit in providing the Service, but not yet documented as a formal Art. 6 basis determination anywhere in this repo prior to this template. |
| Lawful basis identified for End Customer / Contact data | **Partially implemented** | The Business Customer, as controller, is responsible for its own lawful basis (typically consent, per WhatsApp's opt-in requirement) for messaging its Contacts; Metabsp's own basis as processor flows from its contract with the Business Customer (the [DPA](./DATA_PROCESSING_AGREEMENT.md)). No system control verifies the Business Customer actually holds a lawful basis before messages are sent. |
| Lawful basis for security/audit logging | **Implemented (by policy)** | Legitimate interest in securing the platform, reflected in `AuditLog`/`auditLogService.js`'s recording of user, tenant, action, outcome, IP, and user agent — a real, narrowly-scoped security control, though the Art. 6(1)(f) balancing-test documentation itself is not recorded in code. |

## 2. Data Protection Impact Assessment (DPIA) triggers (Art. 35)

| Item | Status | Basis |
|---|---|---|
| DPIA screening conducted | **Not yet implemented — requires operator action** | No DPIA has been conducted. Given that the platform processes message content and contact data at scale on behalf of multiple Business Customers (a form of large-scale processing), the operator should assess DPIA necessity, particularly if special-category data could appear in message content. |
| Ongoing DPIA re-assessment on material feature changes | **Not yet implemented — requires operator action** | No process exists to trigger a DPIA re-check when new processing features (e.g., the AI auto-reply feature using Anthropic) are added. |

## 3. Records of Processing Activities (Art. 30)

| Item | Status | Basis |
|---|---|---|
| Maintained Art. 30 record of processing activities | **Not yet implemented — requires operator action** | No formal ROPA document exists in this repository. The [Privacy Policy](./PRIVACY_POLICY.md) and [DPA](./DATA_PROCESSING_AGREEMENT.md) drafted here describe the categories of data, purposes, and recipients and can serve as a starting input for a ROPA, but they are not themselves a substitute for the Art. 30 record format. |

## 4. Data subject rights implementation (Arts. 15–22)

| Right | Status | Basis |
|---|---|---|
| Right of access (Art. 15) | **Not yet implemented — requires operator action** | No self-service data-export API/UI endpoint was found in `backend/src/routes/` or `backend/bulk/routes/` (only account profile viewing via `GET /me`, not a full personal-data export). Requests must be handled manually today. |
| Right to rectification (Art. 16) | **Partially implemented** | Business Customers can edit contact/account records they control via existing CRUD endpoints; there's no dedicated data-subject-initiated correction request flow for End Customers who are not the Business Customer's own account users. |
| Right to erasure (Art. 17) | **Not yet implemented — requires operator action** | No account-deletion or record-erasure endpoint exists (confirmed by searching `backend/src/routes/` and `backend/bulk/routes/` for delete/export patterns — none found beyond WhatsApp-connection disconnect/deactivate toggles, which mark a WhatsApp Business Account as `isActive: false`/`status: 'disconnected'` rather than erasing underlying contact/message data). This is the most significant GDPR gap identified. |
| Right to restriction of processing (Art. 18) | **Not yet implemented — requires operator action** | No mechanism to flag a specific data subject's records as "restricted" while retaining them exists. |
| Right to data portability (Art. 20) | **Not yet implemented — requires operator action** | No structured export-in-a-portable-format feature exists. |
| Right to object (Art. 21) | **Not yet implemented — requires operator action** | No object/opt-out recording mechanism beyond a Business Customer manually removing a Contact or handling WhatsApp opt-outs itself. |
| Rights related to automated decision-making, including profiling (Art. 22) | **Partially implemented (likely N/A)** | The AI-assisted auto-reply feature (optional, Anthropic-backed) generates message replies but, on review, does not appear to make decisions producing legal or similarly significant effects on a data subject; operator/counsel should confirm this conclusion if the feature's scope expands. |

## 5. Security of processing (Art. 32)

| Item | Status | Basis |
|---|---|---|
| Encryption of personal data | **Implemented (tokens only)** | WhatsApp access tokens are encrypted at rest with AES-256-GCM and support key rotation (`backend/src/utils/crypto.js`). Message/contact data itself is stored in MongoDB without field-level application encryption beyond whatever the hosting/database layer provides at rest — **operator should confirm and document disk/volume-level encryption at the infrastructure layer** if message/contact content encryption at rest is being represented as a control. |
| Ability to ensure ongoing confidentiality, integrity, availability, and resilience | **Partially implemented** | Rate limiting, HMAC webhook verification, JWT re-verification, and `helmet` headers support this; documented restore drills (`docs/BACKUP_RESTORE.md`) support resilience/recoverability testing on a quarterly cadence. |
| Ability to restore availability/access to data in a timely manner following an incident | **Implemented** | Daily backups (14-day retention) and weekly backups (90-day retention), with a documented, scripted restore procedure and a `verify-restore.js` drill script (`docs/BACKUP_RESTORE.md`). |
| Regular testing/evaluation of security measures | **Partially implemented** | Quarterly restore drills are documented as a recommended practice; no evidence of broader periodic penetration testing or security review cadence in this repo (operator to establish if required). |

## 6. Breach notification (Arts. 33–34)

| Item | Status | Basis |
|---|---|---|
| Internal capability to detect a personal data breach | **Partially implemented** | Audit logging and optional Sentry error monitoring provide raw signal; no automated classifier flags an event as a reportable "personal data breach" requiring the 72-hour clock to start. |
| Notification to supervisory authority within 72 hours of becoming aware (Art. 33) | **Not yet implemented — requires operator action** | No such workflow/runbook currently exists in this repo; must be built as an operational process (who decides reportability, who notifies which authority, using what template). |
| Notification to affected data subjects without undue delay where high risk (Art. 34) | **Not yet implemented — requires operator action** | Same as above — the [DPA](./DATA_PROCESSING_AGREEMENT.md) commits Metabsp to notify affected Business Customers, but this is a contractual commitment, not a coded mechanism. |

## 7. Sub-processor disclosure and management (Art. 28)

| Item | Status | Basis |
|---|---|---|
| Written contract/DPA with processor governing processing terms | **Partially implemented** | This template's [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md) is drafted and grounded in real subprocessor usage but requires operator finalization (placeholders) and actual execution with Business Customers before it is a binding Art. 28 contract. |
| Sub-processor list disclosed to controller (Business Customer) | **Implemented (as a list)** | The real subprocessors integrated in this codebase — Meta (WhatsApp Cloud API), Cloudinary (media storage), Cashfree (payments), Sentry (error tracking, optional), Anthropic (AI auto-reply, optional) — are enumerated in both the [Privacy Policy](./PRIVACY_POLICY.md) and the [DPA](./DATA_PROCESSING_AGREEMENT.md), based on the integrations actually present in `backend/.env.example`. |
| Advance notice to controller before adding/replacing a sub-processor | **Not yet implemented — requires operator action** | The DPA template commits to a notice mechanism, but no actual notification system (email list, changelog, in-app notice) currently exists to fulfill that commitment. |
| Sub-processor's own compliance (onward DPAs with Cloudinary, Cashfree, Sentry, Anthropic) | **Not yet implemented — requires operator action** | This repo does not contain evidence of executed DPAs with these vendors; operator must confirm/execute them directly with each vendor. |

## 8. International transfer mechanism (Ch. V)

| Item | Status | Basis |
|---|---|---|
| Transfer mechanism identified for any transfer of EU/EEA personal data outside the EEA | **Not yet implemented — requires operator action** | The [Privacy Policy](./PRIVACY_POLICY.md) and [DPA](./DATA_PROCESSING_AGREEMENT.md) leave this as an explicit placeholder (e.g., Standard Contractual Clauses). Operator must determine actual hosting/subprocessor data-residency and put the correct mechanism (SCCs, adequacy decision, or other) in place before processing EU/EEA personal data outside the EEA. |
| SCCs executed with relevant sub-processors, where applicable | **Not yet implemented — requires operator action** | No such executed SCCs are evidenced in this repository. |

## 9. Data Protection Officer (Art. 37)

| Item | Status | Basis |
|---|---|---|
| DPO appointed, where required (e.g., large-scale/systematic monitoring or large-scale processing of special categories) | **Not yet implemented — requires operator action** | Only a placeholder contact ([DPO CONTACT EMAIL]) exists in these templates; operator/counsel must assess whether Art. 37's mandatory-DPO trigger applies and appoint formally if so. |

## 10. Summary of the most material gaps

1. **No self-service data subject access, erasure, restriction, or portability endpoints** (Section 4) — the single largest gap; only manual account edits and WhatsApp-connection deactivation exist today, not true data erasure.
2. **No Art. 30 Records of Processing Activities document** currently maintained (Section 3).
3. **No automated breach-classification/72-hour notification workflow** (Section 6).
4. **No DPIA conducted or DPIA-trigger process** (Section 2).
5. **International transfer mechanism and sub-processor DPAs are placeholders, not yet executed** (Sections 7–8).

These are flagged honestly rather than glossed over; several require both a legal/operational decision by the operator and, in the case of data-subject-rights automation, actual application development beyond what exists in this codebase today.
