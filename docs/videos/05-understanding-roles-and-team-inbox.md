# 05 — Understanding Roles and the Team Inbox

## 1. Title & Target Audience
**Title:** Understanding Roles and the Team Inbox
**Audience:** New customer (account owner)
**Estimated runtime:** 4-5 min

## 2. Learning Objective
After watching, a viewer understands the platform's roles (admin vs. regular user) and how to give teammates access to a connected WhatsApp number.

## 3. Prerequisites
- A Metabsp account with at least one connected WhatsApp number.
- Teammates who already have their own Metabsp login (team members are added by an existing platform login's mobile number, not by email invite).

## 4. Hook / Cold Open
"You don't have to be the only person replying to customers. Here's how roles work on this platform, and how to give your team shared access to one WhatsApp number."

## 5. On-Screen Setup
- Logged in as the account owner, on `/whatsapp` → Settings.
- A second browser profile or incognito window ready, logged in as a teammate's existing account, to demonstrate the "after" state.

## 6. Step-by-Step Walkthrough
1. **Narration:** "There are two platform-wide roles: admin and regular user. Admins see a management console instead of the regular customer dashboard — billing overview, webhook configuration, and user management. Everyone else sees the customer-facing WhatsApp dashboard."
   **On screen:** Briefly show the admin view's Settings tab (AdminAnalyticsPanel / MetaWebhookConfigPanel / AdminUserManagementPanel) vs. the regular customer Settings view, without diving deep — that's covered in the admin videos.
2. **Narration:** "Within your own connected WhatsApp number, you can share access with teammates through the Team inbox, separate from the platform-wide admin role."
   **On screen:** Scroll to the Team Management section in Settings.
3. **Narration:** "Add a team member by the mobile number they already use to log into this platform — there's no separate email invite flow yet."
   **On screen:** `TeamManagementPanel.jsx` — enter a mobile number, click add.
4. **Narration:** "Once added, that teammate gets full view and reply access to this number's conversations the next time they log in."
   **On screen:** Switch to the teammate's session and show the same account's chats now visible to them.
5. **Narration:** "Only the account owner can add or remove team members — a team member can't add another team member themselves."
   **On screen:** Point out the panel is only reachable from the owner's own Settings view.

## 7. Common Mistakes / Pitfalls
- Trying to add someone who doesn't have a Metabsp account yet — they need to sign up first.
- Expecting per-conversation assignment out of the box — the Team inbox gives shared full access to every conversation on that number; routing individual conversations to specific agents is a separate, API-level capability (covered in video 07).
- A team member who already owns their own separate connected account may not see the shared account as their default view — this is a documented limitation, not a bug.

## 8. Troubleshooting Callout
If a team member reports they can't see an account's conversations, check that the account's team member list actually includes their user ID, and confirm they don't already own a different active WhatsApp account of their own — a user's own account takes priority over shared access in what loads by default. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "A team member can't see an account's conversations."

## 9. Summary / Recap
"Two roles matter here: the platform-wide admin/user distinction, and account-level team sharing for a shared inbox. Add teammates by mobile number, and only the owner controls that list."

## 10. Call to Action & Related Resources
Continue to **06 — The 24-Hour Customer Service Window Explained**. Related reading: `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md`, `docs/meta-tech-provider/SUPPORT_GUIDE.md`.
