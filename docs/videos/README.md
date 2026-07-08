# Video scripts

Ready-to-record scripts for a customer/admin/developer-facing video series covering
the realistic lifecycle of using Metabsp — from signup through advanced
integration, admin operations, and troubleshooting. Every script follows the
same 10-part format (title/audience/runtime, learning objective,
prerequisites, hook, on-screen setup, step-by-step walkthrough, common
mistakes, a troubleshooting callout, summary, and related resources), and
references real routes, UI components, and behavior verified in this
codebase — nothing here describes a feature that doesn't actually exist.

Some of these are also referenced directly from
[`docs/meta-tech-provider/REQUIRED_PERMISSIONS.md`](../meta-tech-provider/REQUIRED_PERMISSIONS.md)
and [`APP_REVIEW.md`](../meta-tech-provider/APP_REVIEW.md) as the evidence
recordings Meta's App Review reviewers expect for each requested permission —
see videos 02, 09, 10, and 11 in particular.

## Getting started / onboarding

| # | Video | Audience |
|---|---|---|
| 01 | [What Is Metabsp? Overview & Creating Your Account](./01-what-is-metabsp-and-getting-started.md) | New customer |
| 02 | [Connecting WhatsApp with Embedded Signup](./02-embedded-signup-demo.md) | New customer |
| 03 | [Meta Business Verification Walkthrough](./03-meta-business-verification-walkthrough.md) | New customer / admin |
| 04 | [Manual Connect with an Existing Token](./04-manual-connect-existing-token.md) | New customer / developer |
| 05 | [Understanding Roles and the Team Inbox](./05-understanding-roles-and-team-inbox.md) | New customer |

## Core messaging features

| # | Video | Audience |
|---|---|---|
| 06 | [The 24-Hour Customer Service Window Explained](./06-twenty-four-hour-customer-service-window.md) | New customer |
| 07 | [Shared Team Inbox and Conversation History](./07-shared-team-inbox-and-conversation-history.md) | New customer / support agent |
| 08 | [Sending a Broadcast with the Cloud API](./08-broadcasts-with-cloud-api.md) | New customer |
| 09 | [Connecting and Managing Additional WhatsApp Numbers](./09-phone-number-registration.md) | New customer / developer |
| 10 | [Sending Text and Template Messages](./10-sending-messages.md) | New customer |
| 11 | [Receiving Messages and Webhook Delivery](./11-receiving-messages.md) | New customer |
| 12 | [Managing Contacts and Imports](./12-contact-management.md) | New customer |

## Advanced / integration

| # | Video | Audience |
|---|---|---|
| 13 | [System User Tokens for Long-Lived Access](./13-system-user-tokens.md) | Admin / developer |
| 14 | [Setting Up Outbound Webhooks for Your Own Systems](./14-outbound-webhooks-for-your-systems.md) | Developer |
| 15 | [The External API and API Keys](./15-external-api-and-api-keys.md) | Developer |
| 16 | [AI Assistant Auto-Reply Setup](./16-ai-assistant-auto-reply.md) | New customer |
| 17 | [Managing Multiple WhatsApp Numbers](./17-multi-waba-multi-number-management.md) | New customer / developer |

## Admin / billing

| # | Video | Audience |
|---|---|---|
| 18 | [Team Member and Permission Management](./18-team-permissions-and-user-management.md) | Admin |
| 19 | [Billing and Invoices](./19-billing-and-invoices.md) | Customer / admin |
| 20 | [Audit Log Review](./20-audit-log-review.md) | Admin / engineering |
| 21 | [Backup and Restore for Admins](./21-backup-and-restore-for-admins.md) | Admin / developer |

## Troubleshooting / support

| # | Video | Audience |
|---|---|---|
| 22 | [Webhook and Signature Errors](./22-webhook-and-signature-errors.md) | Developer / admin |
| 23 | [Token Expiry and Refresh](./23-token-expiry-and-refresh.md) | Admin / support staff |
| 24 | [Template Rejection Reasons](./24-template-rejection-reasons.md) | New customer / support staff |
| 25 | [Where to Find Logs and Health Status](./25-logs-and-health-status.md) | Admin / developer |

## Notable, deliberately honest gaps

A few scripts call out real, current limitations rather than glossing over
them, matching the tone of the rest of `docs/meta-tech-provider/`:

- **Video 07** (shared inbox): per-conversation assignment to a specific
  teammate exists as a backend API (`PUT /api/whatsapp/conversations/:phone/assign`)
  but has no dedicated button in the chat UI yet.
- **Video 20** (audit log): the `AuditLog` collection and its recording are
  fully real, but the in-product Security dashboard's Audit Logs tab
  currently displays sample data, not a live query — there is no backend
  endpoint yet serving real rows to that screen.
- **Video 08** (broadcasts): explicitly distinguishes the official Cloud API
  broadcast feature from the separate Baileys-based "Campaigns" feature,
  which `docs/meta-tech-provider/APP_REVIEW.md` flags as a Platform Terms
  risk — no video in this series treats Campaigns as a recommended feature
  to build a customer-facing walkthrough around.

## Skipped topics

One suggested topic from the original brief was intentionally not turned
into its own video: a dedicated "workflow builder" video was left out in
favor of folding multi-step automation into the AI Assistant / auto-reply
video's related-resources pointer, since the existing Auto Reply video
already covers the primary automation surface most customers use first.
