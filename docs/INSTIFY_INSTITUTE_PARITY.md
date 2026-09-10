# Instify → MetaBSP Institute Service Parity Contract

Source repository: `mesanjusk/Instify`
Source baseline: `fa2bfb42ceb514cce9af09253da466733a0601ba`

## Goal
Port every user-facing Instify capability into MetaBSP under `/services/institute/*` while reusing MetaBSP authentication, tenant/workspace ownership, shared contacts, WhatsApp Cloud integration, billing and service entitlement infrastructure.

## Architecture rules
1. No second login system. MetaBSP auth is authoritative.
2. Every institute-owned record is scoped to the MetaBSP tenant/workspace (or owner user for legacy single-user accounts).
3. Student/lead phone identities sync into the shared MetaBSP Contact layer where practical.
4. MetaBSP WhatsApp is the only WhatsApp provider in the integrated product; Baileys is not duplicated.
5. Institute remains a Pro service and uses the common service entitlement gate.
6. The exact Instify source is pinned at `vendor/Instify`; the source remains the acceptance reference until specialized workflows reach parity.

## Included Institute workspace

### Academic
- Students — tenant CRUD, search, CSV export
- Courses — tenant CRUD, search, CSV export
- Course categories — tenant CRUD, search, CSV export
- Batches — tenant CRUD, search, CSV export
- Education/classes — tenant CRUD, search, CSV export
- Exams — tenant CRUD, search, CSV export
- Attendance — tenant CRUD, search, report view/export
- Attendance report
- Batch report
- Exam report

### Admissions & CRM
- Leads/enquiries — tenant CRUD, shared-contact sync
- Add lead
- Follow-ups
- Admissions
- Add admission
- Admission report
- Lead → admission report
- Funnel report with hot/warm/cold counts
- Forms
- Form responses

### Fees & accounts
- Fees including fee/discount/total/paid/balance/EMI fields
- Receipts
- Payments
- Payment modes
- Accounts
- Account groups
- Transactions
- Student balance report
- Transaction report
- Trial balance workspace
- Profit & loss summary
- UPI payment workspace entry

### Institute & team
- Institute profile
- Multiple institutes/centers
- Owners
- Employees/payroll records
- Users & roles mapped to MetaBSP shared Admin
- Organisation categories

### Data & document tools
- CSV import entry
- Academic bulk import entry
- Bulk download/export entry
- ID card records
- ID card print entry
- Student ID self-edit entry
- Canvas/design workspace entry
- Custom templates
- Greetings
- Institute tools entry

### Communication
- WhatsApp mapped to MetaBSP shared inbox
- WhatsApp settings mapped to MetaBSP shared number/business settings

## Source architecture intentionally mapped instead of cloned at runtime

| Instify capability | MetaBSP mapping |
|---|---|
| Instify JWT/login | MetaBSP shared authentication |
| `institute_uuid` isolation | MetaBSP tenant/user ownership |
| Baileys sessions | MetaBSP WhatsApp Cloud/Coexistence service |
| Instify feature licensing | MetaBSP Basic/Pro entitlement system |
| Instify Users | MetaBSP shared users/admin roles |
| Duplicate WhatsApp settings | MetaBSP shared WhatsApp settings |
| Generic contact identity | MetaBSP shared Contacts |

## Specialized parity still requiring native Next.js adaptation

The complete source is present through the pinned submodule, but these large/source-specific experiences must be adapted rather than executed as a second app inside MetaBSP:

- Fabric.js Canvas Editor exact editing experience
- ID Card Manager exact project/designer/self-edit/print flows
- Public form URL + unauthenticated form submission flow
- Magic-link access flow
- Razorpay/UPI checkout exact payment flow
- Payroll calculation/payslip run behavior beyond employee records
- Offline Dexie queue/PWA sync behavior
- Cloudinary upload flows used by institute documents/designs
- Instify desktop/Electron licensing and sync (platform-specific, not web Institute UI)
- Greetings rich editor exact behavior

These are deliberately not marked complete merely because their icons/routes exist. Their original implementation is pinned in `vendor/Instify` so each can be ported without feature loss.

## Acceptance rule

Institute Management is only declared **full Instify parity** after every specialized item above is either ported natively or formally mapped to an equivalent shared MetaBSP capability. The current phase establishes the complete service surface, tenant-safe data layer, common CRUD/reporting shell and source-code reference without creating duplicate authentication or WhatsApp stacks.
