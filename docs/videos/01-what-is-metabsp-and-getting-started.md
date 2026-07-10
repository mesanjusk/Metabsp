# 01 — What Is Metabsp? Overview & Creating Your Account

## 1. Title & Target Audience
**Title:** What Is Metabsp? Overview & Creating Your Account
**Audience:** New customer (prospective or just signed up)
**Estimated runtime:** 5-6 min

## 2. Learning Objective
After watching, a viewer can explain what Metabsp does, understand the difference between its two WhatsApp products, and create a working account.

## 3. Prerequisites
- None — this is the entry point for a brand-new user.
- A working email/mobile number to sign up with.

## 4. Hook / Cold Open
"If you're sending WhatsApp messages to customers today — order updates, support replies, broadcasts — this video shows you exactly how Metabsp does that, and how to get your own account running in the next few minutes."

## 5. On-Screen Setup
- Browser open to the Metabsp marketing/landing page (`frontend/src/pages/public/LandingPage.jsx`).
- A second tab ready at `/cloud-signup`.
- No account created yet — this is a true first-run recording.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Metabsp is a WhatsApp Business Platform product. There are actually two ways to send messages here, and it matters which one you use."
   **On screen:** Landing page hero section.
2. **Narration:** "The primary, officially-supported path is the WhatsApp Cloud API — Meta's own hosted API. That's what most of this series covers: connecting a number, sending templates, broadcasts, a shared team inbox."
   **On screen:** Scroll to the product-features section of the landing page.
3. **Narration:** "There's also a legacy 'Baileys' option — an unofficial WhatsApp-Web automation client for QR-code based sending. It's useful for quick testing, but it isn't Meta's official API, so treat it differently from your main customer-facing number."
   **On screen:** Point out this is a separate tab in the dashboard (shown fully in later videos) — don't demo it deeply here, just name it.
4. **Narration:** "Let's create an account." Navigate to `/cloud-signup`.
   **On screen:** Fill in the signup form (mobile number + password, per the platform's own signup flow) and submit.
5. **Narration:** "Once you're in, the first real step is connecting a WhatsApp number — that's the next video."
   **On screen:** Land on the empty WhatsApp dashboard at `/whatsapp` showing "No WhatsApp account connected."

## 7. Common Mistakes / Pitfalls
- Confusing the Baileys/legacy product with the Cloud API product — they have different reliability and compliance characteristics; don't assume a feature in one exists in the other.
- Trying to connect a WhatsApp number before finishing account signup.

## 8. Troubleshooting Callout
If signup fails with "account already exists," the mobile number is already registered — use the forgot-password flow at `/cloud-forgot-password` rather than creating a duplicate account. See `docs/meta-tech-provider/SUPPORT_GUIDE.md` for how support staff triage account-access issues.

## 9. Summary / Recap
"You now have a Metabsp account. Next, we'll connect your first real WhatsApp number using Meta's Embedded Signup flow — no credentials ever pass through our servers unencrypted."

## 10. Call to Action & Related Resources
Continue to **02 — Connecting WhatsApp with Embedded Signup**. Related reading: `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md`, `docs/meta-tech-provider/README.md`.
