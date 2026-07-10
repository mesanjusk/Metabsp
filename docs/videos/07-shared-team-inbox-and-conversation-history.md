# 07 — Shared Team Inbox and Conversation History

## 1. Title & Target Audience
**Title:** Shared Team Inbox and Conversation History
**Audience:** New customer / support agent
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can navigate the shared team inbox, search past conversations, and understand how conversations can be routed to a specific teammate.

## 3. Prerequisites
- A connected WhatsApp number with some message history.
- At least one team member added (see video 05).

## 4. Hook / Cold Open
"Every conversation with every customer, in one inbox your whole team can see — here's how to work in it day to day."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Chats (inbox sub-tab), with a handful of existing conversations visible.
- At least one conversation with several messages back and forth, to show scrolling history.

## 6. Step-by-Step Walkthrough
1. **Narration:** "This is the Chats view — every conversation for this connected number, live, in real time."
   **On screen:** `MessagesPanel.jsx` / `ConversationList.jsx` showing the conversation list with last-message previews and unread counts.
2. **Narration:** "New inbound messages arrive over a live socket connection — no manual refresh needed."
   **On screen:** Point out the real-time update as a message arrives (or narrate this if not staged live).
3. **Narration:** "Use the search box to find a conversation by name or number."
   **On screen:** Type into the "Search or start new chat" field.
4. **Narration:** "Click into a conversation to see its full history — every message, in order, with delivery and read status where Meta reports it."
   **On screen:** `ChatWindow.jsx` showing the message thread; scroll up to load older history.
5. **Narration:** "Because this is a shared inbox, anyone on the Team inbox list sees the same conversations — useful for coverage across shifts, but it also means routing matters. Right now, per-conversation assignment to a specific teammate is available as a platform capability that your own integration or an admin script can call — a dedicated one-click 'assign to' button in the chat window itself isn't in this build yet, so if you need visible per-agent routing today, coordinate that over the shared inbox rather than expecting the UI to enforce it."
   **On screen:** Show the conversation list without an assignment control, being explicit that this is the current state.

## 7. Common Mistakes / Pitfalls
- Assuming every teammate on the Team inbox list has a distinct filtered view — today, everyone added sees the full conversation list for that number, not just conversations "assigned" to them in the UI.
- Missing older history because you didn't scroll up — history loads incrementally, it isn't all fetched at once.
- Forgetting that inbox visibility depends on being added as a team member (video 05) — a teammate not yet added won't see anything here.

## 8. Troubleshooting Callout
If a message someone sent from their phone directly (outside Metabsp) doesn't show up, remember this inbox only reflects messages that flow through this connected number's webhook and API — direct app-to-app WhatsApp activity outside the Cloud API isn't visible here. For a teammate seeing no conversations at all, check their team-member status per video 05's troubleshooting note, and `docs/meta-tech-provider/TROUBLESHOOTING.md` under "A team member can't see an account's conversations."

## 9. Summary / Recap
"The shared inbox gives your whole team live visibility into every conversation on a connected number, with full history per contact. Formal per-agent assignment exists at the API level today, without a dedicated UI control yet."

## 10. Call to Action & Related Resources
Continue to **08 — Sending a Broadcast with the Cloud API**. Related reading: `docs/meta-tech-provider/SUPPORT_GUIDE.md`, `docs/api/WEBHOOKS.md`.
