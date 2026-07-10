# 18 — Team Member and Permission Management

## 1. Title & Target Audience
**Title:** Team Member and Permission Management
**Audience:** Admin (platform-level, not a customer's own account owner)
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a platform admin can create and update managed user accounts, assign the admin or user role, and optionally attach WhatsApp credentials during creation.

## 3. Prerequisites
- A platform admin login (`User_group: admin`).

## 4. Hook / Cold Open
"As a platform admin, you have your own console for managing every user account on this deployment — here's where it lives and what it can do."

## 5. On-Screen Setup
- Logged in as an admin user; the WhatsApp dashboard automatically opens to the Meta tab's Settings view, which shows the admin console instead of the customer view.

## 6. Step-by-Step Walkthrough
1. **Narration:** "As an admin, the Settings tab looks completely different — this is the admin console, not the customer dashboard."
   **On screen:** Point out `AdminAnalyticsPanel`, `MetaWebhookConfigPanel`, and `AdminUserManagementPanel` stacked in place of the customer's connect/team/billing panels.
2. **Narration:** "User management lists every platform user, along with whichever WhatsApp account they currently have connected."
   **On screen:** `AdminUserManagementPanel.jsx` table, showing username, role (admin/user), mobile number, and connected WhatsApp account summary.
3. **Narration:** "Create a new user directly from here, choosing their role."
   **On screen:** Click add, fill in username, password, mobile number, and role (`User_group`), save (`POST /api/bulk/auth/manage` in the Users routes).
4. **Narration:** "You can optionally attach WhatsApp credentials right at creation time — useful for provisioning an account on a customer's behalf without them ever pasting a token themselves."
   **On screen:** Show the optional WhatsApp credentials fields in the create form.
5. **Narration:** "Editing an existing user works the same way — change their role, reset details, or update their connected account."
   **On screen:** Edit an existing user's role from user to admin, save.

## 7. Common Mistakes / Pitfalls
- Assigning the admin role casually — admins see cross-tenant analytics and can manage every user, so treat it as a high-trust role.
- Using the username "admin" — it's explicitly reserved and rejected by the platform.
- Forgetting that role changes take effect on session verification, not just at login — a demoted user's existing session is affected on their very next request, not delayed until re-login.

## 8. Troubleshooting Callout
If a user reports losing access unexpectedly, check whether `isActive` was set to false or their role was changed — because JWTs are verified against the database on every request rather than trusted as a claims-only token, deactivating a user takes effect immediately without needing a token blocklist. See `docs/api/AUTHENTICATION.md`.

## 9. Summary / Recap
"The admin console gives you full visibility and control over every platform user and their connected WhatsApp account — use the role assignment carefully, since it's immediate and platform-wide."

## 10. Call to Action & Related Resources
Continue to **19 — Billing and Invoices**. Related reading: `docs/api/AUTHENTICATION.md`, `docs/meta-tech-provider/SUPPORT_GUIDE.md`.
