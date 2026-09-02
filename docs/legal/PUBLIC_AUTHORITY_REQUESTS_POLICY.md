> **This is a template, not legal advice.** It describes this codebase's actual
> technical mechanisms where cited, but must be reviewed and finalized by a
> licensed attorney familiar with your jurisdiction before it is relied on.
> Bracketed placeholders must be completed before publishing externally.

# Responding to Requests from Public Authorities

**Effective date:** [EFFECTIVE DATE]
**Owner:** [NAME / ROLE responsible for receiving and deciding these requests]
**Contact for service of legal process:** [LEGAL CONTACT EMAIL / POSTAL ADDRESS]

This policy governs how [COMPANY LEGAL NAME] ("SanjuSK") responds when a law
enforcement agency, regulator, court or other public authority asks for
personal data held on the platform. It exists because Meta's App Review data
handling questionnaire asks which such processes are in place, and because
answering that question truthfully requires having decided these things in
advance rather than under time pressure with an officer waiting.

It covers requests **for** data. It does not cover our own voluntary reporting
of abuse, which is dealt with in `ACCEPTABLE_USE_POLICY.md`.

---

## 1. What we actually hold

A request can only reach data that exists. What exists is:

| Category | Where | Notes |
|---|---|---|
| Message content and metadata | MongoDB | Inbound and outbound WhatsApp messages for connected numbers |
| Contacts | MongoDB | Phone numbers and profile names as supplied by WhatsApp |
| Media attachments | Cloudinary | Re-hosted from Meta's expiring URLs |
| Account records | MongoDB | Platform users, their mobile numbers, roles |
| WhatsApp Business Account connections | MongoDB | WABA and phone number identifiers |
| Meta access tokens | MongoDB | **AES-256-GCM encrypted at rest** |
| Audit log | MongoDB | Actor, action, resource, outcome — never message content |

Two consequences follow directly from that table.

**We are a processor, not the controller, for customer conversations.** The
business that connected its WhatsApp Business Account decides why and how its
customer conversations are processed. We hold that data on their behalf. A
request for a particular business's messages is, in substance, a request to
that business — see §3.

**Access tokens are not usefully disclosable.** They are encrypted at rest and
decryptable only with a key held in the deployment environment, not in the
database. Producing ciphertext in response to a request for "the account
credentials" is not a meaningful disclosure, and we say so rather than
producing something that looks responsive and is not.

## 2. Required review of the legality of every request

**No data is disclosed on the basis of a request alone.** Every request is
reviewed before any search is run, and the review is recorded. The reviewer
establishes:

1. **Authenticity** — that the request genuinely originates from the authority
   it claims. Contact details are verified independently of the request itself,
   never by replying to the address that sent it.
2. **Authority and jurisdiction** — that the issuing body has power to compel
   this category of data from an entity in [JURISDICTION], and that the
   instrument used (warrant, court order, statutory notice, informal request)
   actually carries compulsion. **An informal request carries none**, and is
   treated as a request we may decline.
3. **Scope** — that the data sought is specified rather than open-ended.
4. **Legal basis** — the specific provision relied on.

Where the request is not compulsory, or its legality is unclear, the default
is to **decline pending clarification**, not to comply. Disclosing data we were
not obliged to disclose cannot be undone.

Emergency requests asserting risk to life are the one exception to the timing,
not to the review: they are reviewed immediately rather than not at all, and
the grounds for the emergency assessment are recorded.

## 3. Redirect to the controller wherever possible

For data belonging to a business customer, our first response is to direct the
authority to that customer, who is the controller and better placed to assess
the request against its own obligations.

Where we are compelled to produce it ourselves, we **notify the affected
customer before disclosure** so they can exercise their own rights, unless we
are legally prohibited from doing so. Where a non-disclosure obligation applies,
we record its legal basis and expiry, and notify once it lapses.

## 4. Challenging unlawful or overbroad requests

We will challenge a request, through counsel, where review finds it:

- issued without jurisdiction or authority over us;
- unsupported by the legal basis it cites;
- disproportionate or unbounded — no date range, no named accounts, "all data
  relating to" a broad class;
- seeking data we cannot lawfully disclose in [JURISDICTION];
- accompanied by a non-disclosure requirement broader or longer than the law
  permits.

Where a request is partly valid, we narrow rather than refuse entirely, and
produce only the valid part.

Budget and counsel for this are identified in advance — [NAMED COUNSEL / FIRM].
A challenge process that exists only on paper is not a process.

## 5. Data minimisation in what we disclose

We disclose the **minimum** responsive to the specific request:

- Only the accounts, numbers and date ranges named. A request about one
  conversation does not produce an account export.
- **Metadata before content.** Where the request is satisfied by the fact that
  messages were exchanged, we do not produce what was said.
- Redaction of third parties incidentally present in a conversation who are
  not named in the request.
- No bulk or standing access. We do not provide direct database access,
  credentials, or an ongoing feed. Each disclosure is a discrete, reviewed
  production.
- Encrypted values are produced as ciphertext; we do not decrypt on request
  absent a specific, reviewed obligation to do so.

## 6. Documentation

Every request is recorded, whether or not it results in disclosure, in a
register held at [LOCATION OF REGISTER]. Each entry records:

- date received, and how;
- issuing authority, named officer, and how authenticity was verified;
- legal instrument and the provision relied on;
- exactly what was sought;
- who reviewed it, and the legal reasoning for the decision;
- whether it was complied with, narrowed, challenged or declined;
- exactly what was disclosed, and when;
- whether the affected customer was notified, or the basis for not notifying.

Where a disclosure is made from the platform, the operator actions taken to
retrieve it are independently captured in the application's own audit log
(`AuditLog`, written by `recordAuditEvent`), which records actor, action,
resource and outcome. That is a technical record of *access*, not a substitute
for the register above, which records the *decision*.

Retain register entries for [RETENTION PERIOD — note this is a separate
decision from `RETENTION_AUDIT_LOG_DAYS`, which governs the application's own
audit log].

## 7. Transparency reporting

We publish the number of requests received and complied with, by category and
authority type, [ANNUALLY / SEMI-ANNUALLY] at [URL], to the extent permitted.
Where legal prohibitions prevent reporting a figure, we say that a figure has
been withheld rather than reporting zero.

**As at [DATE], no personal data has been disclosed to any public authority in
response to a national security request.** This is the statement that supports
the corresponding answer in Meta's data handling questionnaire, and it must be
re-checked, not assumed, each time that questionnaire is completed.

## 8. Mapping to Meta's data handling questionnaire

Meta asks which processes are in place regarding requests from public
authorities. With this policy adopted **and followed**, these are true:

| Meta's option | Section |
|---|---|
| Required review of the legality of these requests | §2 |
| Provisions for challenging these requests if they are considered unlawful | §4 |
| Data minimization policy — the ability to disclose the minimum information necessary | §5 |
| Documentation of these requests, including your responses, the legal reasoning and actors involved | §6 |

Adopting the document is what makes those answers true. Filing it unread does
not: the questionnaire asks what you *have in place*, and a policy nobody has
read is not in place. Before ticking those boxes, confirm that the owner in the
header knows they are the owner, that counsel in §4 has agreed, and that the
register in §6 exists and is empty rather than absent.
