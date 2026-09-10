# Instagram API — Setup and App Review

This project uses **Instagram API with Instagram Login** (Business Login for Instagram), not the older Facebook-Page-linked login flow. It is intended for Instagram **Business and Creator** accounts.

## Permissions requested

The dashboard requests only the permissions that have an implemented user-facing feature:

| Permission | Why MetaBSP needs it | Reviewer evidence in `/instagram` |
| --- | --- | --- |
| `instagram_business_basic` | Identify the connected professional account and load its owned media | Connected account card and media list |
| `instagram_business_manage_messages` | Load conversations and reply to customers who initiated a conversation | **Messages** tab |
| `instagram_business_manage_comments` | Load comments and send the supported private reply to a commenter | **Comments** tab |
| `instagram_business_content_publish` | Publish an image owned/authorized by the business | **Publish** tab |

Do not request deprecated `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, or `instagram_content_publish` for this Instagram Login flow.

## Meta App Dashboard configuration

1. Add/configure the **Instagram API** product and choose the Instagram Login / Business Login for Instagram flow.
2. Copy the Instagram App ID and App Secret into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` on the production deployment.
3. Add the exact OAuth redirect URI:

   `https://<YOUR-PRODUCTION-DOMAIN>/api/instagram/oauth/callback`

   Set the same exact URL in `INSTAGRAM_REDIRECT_URI`, or leave it empty and ensure `FRONTEND_URL` is the production origin.
4. Configure the Instagram webhook callback URL:

   `https://<YOUR-PRODUCTION-DOMAIN>/api/instagram/webhook`

5. Set a strong random `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in the deployment and enter the exact same value in Meta's webhook setup.
6. Keep `INSTAGRAM_ENFORCE_WEBHOOK_SIGNATURE=true` in production.
7. Subscribe the Instagram product/app to the event fields needed by the implemented features, including messages/postbacks and comments. The application also calls `/{ig-user-id}/subscribed_apps` after a successful connection.

## Standard Access testing before review

While the Meta app is in development/testing, use an Instagram professional account that is permitted to test the app. For messaging review, a second Instagram account should send a DM to the professional account first because the API does not create an unsolicited conversation.

## Reviewer walkthrough

Use one continuous recording and show the complete flow rather than separate mock screens:

1. Sign in to the MetaBSP reviewer account.
2. Open **Instagram** from the dashboard sidebar.
3. Click **Connect Instagram account** and complete Instagram authorization.
4. Return to `/instagram` and show the connected username/profile. This demonstrates the basic permission.
5. Open **Messages**, load a conversation that was initiated by the test customer, open it, and send a reply. This demonstrates message management.
6. Open **Comments**, load owned media, select a post with a recent test comment, select that comment, and send a private reply. This demonstrates comment management.
7. Open **Publish**, enter a publicly reachable HTTPS image URL, add a test caption, and publish. Show the new post on Instagram. This demonstrates content publishing.
8. Show that the account can be disconnected from the dashboard.

## Advanced Access

Standard Access is suitable for accounts owned/managed by the app developer and configured for testing. To sell this feature to customer businesses whose Instagram professional accounts you do not own/manage, request **Advanced Access** for the permissions used by the production flow.

## Security notes

- OAuth state is signed with the dashboard JWT secret and expires after 10 minutes.
- Instagram access tokens are exchanged only on the server and stored encrypted at rest.
- The App Secret and Instagram access token are never returned to the browser.
- Webhook POST signatures are checked with `X-Hub-Signature-256` when production enforcement is enabled.
- The webhook currently records delivery health (`lastWebhookAt`). Business automation/event persistence can be added on top without changing the Meta authorization flow.

## Implemented routes

- `GET /api/instagram/oauth/url`
- `GET /api/instagram/oauth/callback`
- `GET|DELETE /api/instagram/account`
- `GET /api/instagram/conversations`
- `GET|POST /api/instagram/messages`
- `GET /api/instagram/media`
- `GET|POST /api/instagram/comments`
- `POST /api/instagram/publish`
- `GET|POST /api/instagram/webhook`
