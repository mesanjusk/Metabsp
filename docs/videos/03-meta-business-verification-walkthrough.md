# 03 — Meta Business Verification Walkthrough

## 1. Title & Target Audience
**Title:** Meta Business Verification Walkthrough
**Audience:** New customer / admin (whoever owns the Meta Business Manager account)
**Estimated runtime:** 4-6 min

## 2. Learning Objective
After watching, a viewer understands why Meta Business Verification is required, what Meta actually checks, and what to prepare before starting it.

## 3. Prerequisites
- A Meta Business Manager account.
- Business registration documents (certificate of incorporation or local equivalent), a working business phone number, and a live website domain you control.

## 4. Hook / Cold Open
"Before you can send more than a handful of conversations a day, Meta needs to verify your business is real. This is entirely inside Meta's own console — here's exactly what they check and how to avoid a rejection."

## 5. On-Screen Setup
- Meta Business Manager open, logged in as an admin.
- Business documents ready (as a reference, not necessarily uploaded on screen).
- No Metabsp UI needed for this video — this process happens entirely outside our platform.

## 6. Step-by-Step Walkthrough
1. **Narration:** "This isn't something Metabsp does for you — there's no button in our dashboard for this. It's a Meta-side process against your Business Manager account."
   **On screen:** Meta Business Manager → Business Settings.
2. **Narration:** "Navigate to Business Settings → Security Center → Start Verification."
   **On screen:** Click through to the verification start screen.
3. **Narration:** "Meta checks three things: your legal business name and address matching your registration documents, a working business phone number and a website domain you control, and a named business representative with authority to confirm these details."
   **On screen:** Walk through each form field, narrating what's being asked without submitting real data on camera.
4. **Narration:** "Why does this matter for messaging? Without verification, Meta caps your messaging tier — a small number of unique conversations per rolling 24 hours — and won't grant the permissions our app needs for production use beyond your own test numbers."
   **On screen:** Cut to a slide or the REQUIRED_PERMISSIONS table (`docs/meta-tech-provider/REQUIRED_PERMISSIONS.md`) as a reference graphic.
5. **Narration:** "Budget same-day to a couple of weeks depending on how quickly Meta can confirm your documents and how clean your public footprint is — do this well before you plan to submit for App Review."

## 7. Common Mistakes / Pitfalls
- Business name in Business Manager not matching legal documents exactly.
- Submitting domain verification with no live, reachable website at that domain.
- Using a business phone number that doesn't match any listed registration record.

## 8. Troubleshooting Callout
There is no in-app fix for a rejected verification — it's entirely Meta's process. If verification is rejected, compare the exact rejection reason Meta gives against the three checks above, correct the mismatch, and resubmit. See `docs/meta-tech-provider/BUSINESS_VERIFICATION.md` for the full breakdown of common rejection reasons.

## 9. Summary / Recap
"Business Verification unlocks higher messaging limits and is a prerequisite for App Review. It's Meta's process, not ours — get your documents aligned before you start the clock."

## 10. Call to Action & Related Resources
Continue to **04 — Manual Connect with an Existing Token** or, if you're preparing for App Review, see `docs/meta-tech-provider/APP_REVIEW.md`. Related reading: `docs/meta-tech-provider/BUSINESS_VERIFICATION.md`.
