# 19 — Billing and Invoices

## 1. Title & Target Audience
**Title:** Billing and Invoices
**Audience:** Customer (account owner) / admin
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can view available subscription plans, subscribe via UPI Autopay, and download a past invoice as a PDF.

## 3. Prerequisites
- A Metabsp account.
- For subscribing: a UPI-enabled bank account/app to complete the mandate authorization.

## 4. Hook / Cold Open
"Here's exactly what you're billed for, how to subscribe to a plan, and where your invoices live."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Settings, scrolled to the Billing panel.

## 6. Step-by-Step Walkthrough
1. **Narration:** "The Billing panel shows the available plans, your current subscription, and your invoice history."
   **On screen:** `BillingPanel.jsx` loading plans, current subscription, and invoices together.
2. **Narration:** "Subscribing to a plan opens a UPI Autopay authorization in a new tab — you approve a small token authorization amount there, which sets up the recurring mandate for the full plan price."
   **On screen:** Click subscribe on a plan, show the new tab opening with the authorization link.
3. **Narration:** "Once authorized, your subscription becomes active, and future billing periods generate invoices automatically."
   **On screen:** Return to the panel, show the subscription status chip (active/pending mandate/past due).
4. **Narration:** "Each invoice shows the plan amount, any overage messages billed beyond your plan's included volume, and the total."
   **On screen:** Point at an invoice row showing plan amount, overage count, and total.
5. **Narration:** "Download any invoice as a PDF directly from here."
   **On screen:** Click download on an invoice (`GET /api/billing/invoices/:id/pdf`), show the downloaded PDF.
6. **Narration:** "If you ever dispute a charge, the message-count figure behind your invoice is a real count against your actual sent messages for that billing period — not an estimate."
   **On screen:** No visual needed; narrate this as reassurance.

## 7. Common Mistakes / Pitfalls
- Closing the UPI authorization tab before completing the mandate — the subscription will show "pending mandate" until it's finished.
- Assuming an invoice total is negotiable or adjustable from this panel — invoices are generated from actual usage and plan pricing, not editable here.
- Disputing a message count without checking the actual sent-message history first — the count is auditable against real data.

## 8. Troubleshooting Callout
If a customer reports being charged for messages they say they didn't send, this is verifiable against the real message-count query for their billing period, not an estimate — escalate billing disputes about the message count with the specific invoice number and period. If the dispute is about the payment itself (double charge, failed UPI mandate), escalate to engineering rather than resolving it as a first-line support action — the payment gateway integration is explicitly flagged as needing verification against live behavior before being treated as fully reliable. See `docs/meta-tech-provider/SUPPORT_GUIDE.md` under "I got charged for messages I didn't send."

## 9. Summary / Recap
"Plans, subscription status, and downloadable invoices with a real, auditable message count behind every total — that's the full billing picture from inside the platform."

## 10. Call to Action & Related Resources
Continue to **20 — Audit Log Review**. Related reading: `docs/meta-tech-provider/SUPPORT_GUIDE.md`, `docs/meta-tech-provider/ACCESS_TOKENS.md`.
