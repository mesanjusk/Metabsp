# Google Business Profile AI Manager — integration readiness

This module already exists under `/services/google-business`. These are the
prerequisites repository code cannot prove about the production Google Cloud
project or the business's live Google Business Profile.

## Google-controlled API eligibility

Google's [current prerequisites](https://developers.google.com/my-business/content/prereqs)
require the applicant to manage a Business Profile that is **verified and
active for at least 60 days**, and the profile must list a website representing
the business. Apply from an account that owns or manages the profile.

1. Create or select a Google Cloud project and note the **project number**.
2. Submit Google's GBP API contact form under **Application for Basic API Access**.
3. Check Business Profile API quota in Google Cloud: Google documents **0 QPM**
   as not yet approved and **300 QPM** as approved.
4. After approval, enable Business Profile Account Management, Business
   Information, Performance and My Business v4 APIs in that project.
5. Create an OAuth **Web application** client. For production, register
   `https://meta.sanjusk.in/api/google-business/oauth/callback` as an exact
   authorized redirect URI (adapt the hostname for another deployment).
6. Store the OAuth client ID and secret in the admin credential screen or
   deployment secrets, **never in GitHub**. Sign in to MetaBSP and select
   the correct business location. OAuth success alone does not prove API access.

## Safe rollout and acceptance checks

- Start read-only: confirm a live location, its category/description and the
  Google review total. Check whether paginated review coverage is complete.
- Only test a public review reply or post after the profile owner approves its
  exact content. Leave automatic replies disabled until explicitly enabled.
- A Gemini key (`GEMINI_API_KEY`) is separate from the Business Profile OAuth
  client, and usage may incur charges.
- Do not add keywords to the business name unless they are part of its real
  public-facing name. Categories and services must describe genuine offerings.
- Google Business Profile Performance does **not** return search rank positions
  or competitors. Keep third-party rank measurements clearly labeled as such.
- Merge only after CI succeeds and a PR is reviewed; production credentials,
  approval status and Google authorization are manual deployment gates.

## First owner acceptance test

1. Connect the owner-managed Google account.
2. Confirm the business title and address correspond to SANJU SK Digital –
   Mahi Creation, not an unrelated managed location.
3. Open the read-only audit; compare total, replies and average rating with
   the Google owner dashboard, including pagination completeness.
4. Generate a draft for one existing review and check the language, facts and
   tone. Do not publish in this test.
5. Check the Search/Maps performance period, then test an approved post only
   when the live profile has the required permissions.

## References

- [Business Profile API prerequisites](https://developers.google.com/my-business/content/prereqs)
- [Business Profile API overview](https://developers.google.com/my-business/)
- [Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest)
