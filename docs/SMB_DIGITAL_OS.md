# Small Business Digital OS

MetaBSP is evolving from a channel dashboard into a small-business operating layer. The design principle is simple: one customer identity, one shared business history, and separate channel/provider adapters around it.

## Core data rule

`Contact` remains the shared customer identity. WhatsApp, Instagram and future channels should resolve to the same contact whenever possible. The new `SmbRecord` model stores business events and links them back to that contact instead of creating separate CRM customer tables.

Each `SmbRecord` is owner-scoped and can optionally point to:

- `contactId` — the shared customer
- `parentId` — the previous record in a workflow
- `kind` — lead, follow-up, quotation, order, customer invoice, payment, task, expense, vendor, product, inventory movement, review request, or note

This gives a traceable chain such as:

`Contact → Lead → Follow-up → Quotation → Order → Customer Invoice / Payment`

## Phase 1 — Revenue engine

Status: **beta implemented**

The Mini CRM now provides:

- lead capture linked to the shared Contact model
- follow-up records and due dates
- quotation records
- order/job records
- one-click workflow conversion while preserving parent history
- assigned staff, references, amounts and outstanding balances
- shared owner summary metrics

The Payments & Documents workspace adds:

- customer invoices stored separately from MetaBSP subscription invoices
- payment/collection records
- expense records
- printable quotation, order/job sheet, customer invoice and payment receipt views
- browser Print / Save PDF support

### Billing separation

The existing MetaBSP `Invoice` model remains reserved for platform subscription billing. Small-business customer invoices use `SmbRecord(kind="invoice")`, so SaaS billing can never be mixed with a customer's own sales documents.

The current printable customer invoice is an operational document, not a statutory GST/e-invoice implementation. GSTIN, HSN/SAC, tax calculation, e-invoice IRN and accounting integrations should be added through a dedicated tax/accounting layer.

## Phase 2 — Operations engine

Status: **beta implemented, using the existing attendance subsystem**

The Staff & Tasks workspace provides:

- task ownership and due dates
- overdue-task visibility
- vendor records and responsibility tracking
- links back to shared customers where applicable

Attendance is **not duplicated in `SmbRecord`**. MetaBSP already has a dedicated hybrid attendance subsystem with:

- WhatsApp attendance commands
- attendance profiles/settings
- biometric attendance devices
- device punch/heartbeat APIs
- attendance records and UI

The Staff workspace reuses that existing Attendance panel.

## Phase 3 — Growth engine

Status: **internal beta; external providers remain gated**

The Mini Store workspace now provides the shared internal data layer for:

- products
- inventory movements
- review requests
- owner metrics around products and outstanding orders

Existing Marketing & Publisher and Instagram features remain separate channel tools that can write activity back into the shared workspace.

Still provider-gated / intentionally not faked:

- Google Business Profile connection and review/post APIs
- business dialer / cloud telephony provider
- public checkout/storefront and payment gateway
- statutory accounting/GST integrations

These should be connected only when real credentials/provider contracts are available.

## Phase 4 — Business Copilot

Status: **beta implemented**

The Business Copilot answers from live owner-scoped workspace records. It currently supports operational questions around:

- due follow-ups
- open leads
- open orders
- overdue tasks
- outstanding balances
- monthly sales
- monthly collections
- monthly expenses

The initial implementation is deterministic and grounded in stored business data. A future LLM layer can translate broader natural-language questions into the same safe, owner-scoped queries without changing the underlying source of truth.

## APIs

- `GET/POST /api/smb/records`
- `PATCH/DELETE /api/smb/records/:id`
- `POST /api/smb/records/:id/convert`
- `GET /api/smb/records/:id/document`
- `GET /api/smb/summary`
- `POST /api/smb/assistant`

All routes require the existing authenticated session and scope queries to the authenticated owner.

## Product status rules

A service should only be marked active/beta when it has a real usable workspace. External services stay `planned` until a real provider connection exists. This is why Google Business Profile and Business Dialer remain planned while CRM, Store, Staff and Payments are promoted to beta.
