# Instify → MetaBSP Institute Service Parity Contract

Source repository: `mesanjusk/Instify`
Source baseline: `fa2bfb42ceb514cce9af09253da466733a0601ba`

## Goal
Port every user-facing Instify capability into MetaBSP under `/services/institute/*` while reusing MetaBSP authentication, tenant/workspace ownership, shared contacts, WhatsApp Cloud integration, billing and service entitlement infrastructure.

## Feature groups to preserve

### Dashboard & institute administration
- Institute dashboard and quick actions
- Institute profile
- Multiple institutes/centers
- Owners
- Users/roles
- Organisation categories
- App/feature configuration

### Academic management
- Students
- Courses
- Course categories
- Batches
- Education/class setup
- Exams
- Attendance entry
- Attendance reports
- Batch reports
- Exam reports

### Admissions & CRM
- Enquiries/leads
- Add lead
- Follow-ups
- Admissions
- Admission reports
- Lead-to-admission reports
- Funnel report
- Public forms
- Form responses
- Magic/public access links

### Finance & accounting
- Fees
- Receipts
- Payments
- Payment modes
- Accounts
- Account groups
- Student balances
- Transaction reports
- Trial balance
- Profit & loss
- UPI payment
- Razorpay/payment integration where configured

### Staff / HR
- Employees
- Payroll-related employee data
- User administration

### Imports / exports
- CSV import
- Academic bulk import
- Bulk download/export

### Documents / design
- ID card management
- Student self-edit/preview link
- ID card print
- Canvas/design editor capabilities
- Custom templates/design records
- Greetings

### Messaging
- Institute-related WhatsApp actions must map to the existing MetaBSP WhatsApp Cloud service and shared contacts.
- Do not port Baileys as a second WhatsApp transport.
- Preserve the business workflows that use WhatsApp, including admission/fee/follow-up communication.

### Platform capabilities
- Responsive mobile/desktop UI
- PWA/offline workflow where still applicable inside the MetaBSP shell
- Cloudinary-backed media where required

## Migration rules
1. No second login system. MetaBSP auth is authoritative.
2. Every institute-owned record must carry tenant/workspace ownership.
3. Shared people/contact identity must reuse the MetaBSP shared contact layer where practical; academic-specific fields remain in Institute models.
4. Existing MetaBSP WhatsApp is the only WhatsApp provider for the integrated service.
5. Instify source remains the parity reference until every route is marked `ported`, `mapped-to-shared-service`, or `intentionally-retired` with a reason.
6. Institute service is not considered feature-complete while any source route is unaccounted for.

## Source route inventory

- Dashboard
- Academic hub
- Admin hub
- Users
- Batches
- Courses
- Students
- Organisation categories
- Education
- Exams
- Payment modes
- Institute profile
- Owners
- Institutes/centers
- Course categories
- Leads
- Admissions report
- Lead by admission report
- Add lead
- Add admission
- Add receipt
- Add payment
- Add account
- Follow-up
- Add attendance
- Attendance report
- Balance report
- Batch report
- Exam report
- Fees
- Tools
- Transactions
- UPI payment
- CSV import
- Academic bulk import
- Bulk download
- Employees
- Trial balance
- Profit & loss
- Funnel report
- Forms
- Form responses
- ID card / canvas tools
- ID card print
- Student ID self-edit/preview
- Greetings
- WhatsApp integration settings/workflows

## Current integration status

This document is the acceptance checklist for the Institute port. The original Instify repository remains available as a git source reference under `vendor/Instify` so implementation can be checked against the exact source baseline rather than reconstructed from memory.
