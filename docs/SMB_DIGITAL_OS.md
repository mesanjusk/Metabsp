# Small Business Digital OS

MetaBSP is evolving from a channel dashboard into an India-first small-business
**growth operating system**. The design principle is simple: one customer
identity, one shared business history, and separate channel/provider adapters
around it.

## North star

The product exists for businesses that already use specialised tools but do not
have the time, team or technical knowledge to make those tools work together.

The promise is:

> Keep the tools you already use. MetaBSP connects customer conversations,
> business history and growth channels, then tells the owner who needs attention,
> why, and what measurable business value is at stake.

The daily product loop is **Reach → Convert → Retain → Measure**.

The home screen should become progressively less like an app launcher and more
like a daily action list:

- customers waiting for a reply
- leads and quotations that need follow-up
- overdue receivables that need collection
- past customers likely to buy again
- reviews and local-profile actions that can improve discovery
- channel/campaign activity tied back to leads, orders and collections where the
  source data is reliable

The customer/contact is the spine. WhatsApp, Instagram, Google Business Profile,
marketing, accounting adapters and future channels are inputs/outputs around the
same customer history.

## Product guardrails

1. **Do not replace accounting first.** Integrate with the systems merchants
   already trust. BUSY outbound invoice/message integration exists today. Tally,
   Marg and deeper transaction sync are separate adapters to build and verify,
   not features to label live in advance.
2. **Do not create a second CRM per channel.** Channel identities resolve to the
   shared Contact whenever possible.
3. **Do not add a module without an owner outcome.** A feature must improve
   acquisition, conversion, retention, collection, attribution or operating
   accountability.
4. **Do not fake provider readiness.** A service stays planned until credentials,
   provider/client behaviour and a real end-to-end flow are verified.
5. **Prefer next-best-action over dashboards.** Metrics should end in a useful
   action: reply, follow up, collect, reactivate, request a review or publish.
6. **Protect focus.** MetaBSP is not trying to clone every Odoo module. It should
   connect the minimum business data needed to help an Indian SME grow without a
   dedicated marketing or IT team.

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

Google Business Profile is now connected rather than planned — see
[GOOGLE_BUSINESS_PROFILE.md](./GOOGLE_BUSINESS_PROFILE.md).

Accounting interoperability:

- **BUSY outbound WhatsApp/invoice connector — implemented.** It is a secure,
  send-only adapter and is not a full ledger/customer sync.
- **BUSY customer/transaction sync — roadmap.**
- **Tally adapter — roadmap.**
- **Marg adapter — roadmap.**
- Synced transactions should enrich the existing Contact/SmbRecord history,
  never create a parallel accounting-owned customer database.

Still provider-gated / intentionally not faked:

- business dialer / cloud telephony provider
- public checkout/storefront and payment gateway
- statutory GST/e-invoice/accounting write-back beyond verified adapters

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

A service should only be marked active/beta when it has a real usable workspace. External services stay `planned` until a real provider connection exists. Google Business Profile moved from `planned` to `beta` when it gained a real Google OAuth connection and live review/post/performance calls; the same rule still keeps anything without a provider connection out of `beta`.

"Connected" is also held to that standard inside a service. A Google connection with no location selected reports as `pending`, not `connected`, because it can neither read reviews nor publish a post.


## Delivery order from this point

The roadmap is deliberately ordered by customer value rather than by number of
modules:

1. Strengthen shared customer identity and deduplication.
2. Make WhatsApp + CRM follow-up the daily operating habit.
3. Expand accounting adapters from the existing BUSY connector into safe
   read/sync flows, then add Tally and Marg behind the same contract.
4. Turn orders, quotations, balances and message history into next-best actions
   for follow-up, collection and repeat business.
5. Add marketing attribution only where a source can be tied reliably to a lead,
   order or collection.
6. Deepen Google Business Profile and Instagram/Facebook growth workflows.
7. Add AI as an explanation/action layer over grounded data, not as a separate
   database or a substitute for deterministic business rules.

Success is not the number of available modules. Success is that a small-business
owner can open one screen and understand **who to contact, what to do, and what
business result it may affect**.
