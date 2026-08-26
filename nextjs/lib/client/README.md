# `lib/client/`

Browser-side code. Everything under here runs in the user's browser and talks
to this app's own API routes over HTTP.

The distinction from `lib/services/` matters and is not stylistic:

| | runs where | talks to |
|---|---|---|
| `lib/services/` | the server, inside API route handlers | MongoDB, Redis, the Graph API |
| `lib/client/services/` | the browser, inside components | this app's `/api/*` routes, over HTTP |

Several names collide across the two — `whatsappAccountService`,
`billingService` — because they are two ends of the same feature. Importing the
server one from a client component would pull mongoose, ioredis and the
decryption key path into the browser bundle, so keep the directories apart and
let the import path make the side obvious at a glance.
