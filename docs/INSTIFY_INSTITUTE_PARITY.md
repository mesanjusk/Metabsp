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
- Admissions — **native model/API; tenant scoped; legacy records remain readable/editable during migration**
- Add admission — **native 3-step Student → Course/Batch → Fees/Payment workflow**
- Admission workflow — **creates/selects student, creates admission, creates fee plan, syncs shared Contact, can mark a source lead converted**
- Admission report
- Lead → admission report
- Funnel report with hot/warm/cold counts
- Forms — **native form builder with custom fields, active/inactive state and public link**
- Public forms — **unauthenticated public URL, required-field validation and configurable success message**
- Form responses — **native response store, dashboard view and CSV export**
- Public form → CRM — **optional automatic lead creation and shared Contact sync**

### Fees & accounts
- Fees — **native fee plan with fee, discount, total, paid, balance, installments and EMI schedule**
- Receipts — **native collection endpoint updates paid/balance and allocates receipts against installments**
- Legacy fee records remain visible and can still receive receipts during migration
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
- ID Card Manager — **native project workflow, student import, class/roll tracking and status management**
- ID-card student magic link — **7-day public verification/self-edit link**
- ID-card approval/reject — **native review workflow**
- ID Card Print — **renders assigned reusable design template for project students**
- Canvas / Design Editor — **native visual template editor with reusable text/photo elements and student placeholders**
- Template assignment — **saved ID-card templates can be assigned to projects for preview/self-edit/print**
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

The remaining source-specific work is:

- Advanced Fabric-style editing parity beyond the new native visual canvas (free-drag/resize/rotate, richer object types, exact legacy canvas import)
- Direct media upload + Cloudinary AI background-removal flow for ID-card photos; URL-based photo/self-edit flow is native now
- UPI payment config + QR generation
- Razorpay: **not present in the pinned Instify source baseline; this would be a new integration, not a source port**
- Payroll calculation/payslip run behavior beyond employee records
- Offline queue/PWA sync behavior
- Greetings rich editor exact behavior
- Instify desktop/Electron licensing and sync (platform-specific, not required for the web Institute service unless explicitly desired)

Admissions, fee collection, ID-card project/self-edit/print workflow, native template editing, public forms and form-response/magic-link flows are no longer listed as missing.

## Acceptance rule

Institute Management is only declared **full Instify parity** after every remaining specialized item above is either ported natively or formally mapped to an equivalent shared MetaBSP capability.
