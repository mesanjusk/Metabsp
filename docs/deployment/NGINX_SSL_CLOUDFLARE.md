# Nginx, TLS, and Cloudflare

Reverse-proxy and TLS setup for running Metabsp's API behind nginx, with an
optional Cloudflare layer in front of that. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for where this
sits in the overall topology.

## Why `TRUST_PROXY` matters here

`backend/src/app.js` reads `TRUST_PROXY` as a hop count and calls
`app.set('trust proxy', ...)` with it:

```js
// Required behind any reverse proxy/load balancer (Render, Railway, nginx,
// Cloudflare, ...) — without it, req.ip resolves to the proxy's address for
// every request, which would make the Redis-backed rate limiter (keyed by
// req.ip for unauthenticated routes) treat every user behind that proxy as
// a single client.
```

This isn't just about log accuracy: `express-rate-limit` +
`rate-limit-redis` key unauthenticated routes (login, webhook, etc.) by
`req.ip`. Get the hop count wrong in either direction and you either (a)
bucket every real user behind the proxy under one shared rate limit, or (b)
trust a client-supplied `X-Forwarded-For` header for an IP that never
actually passed through a proxy, letting anyone spoof their rate-limit
identity.

- **nginx directly in front of one app instance** (no Cloudflare, no
  additional LB) — that's **one hop**, so `TRUST_PROXY=1` (the default in
  `backend/.env.example`).
- **nginx behind Cloudflare** — Cloudflare's edge adds its own hop before
  your origin nginx, and if your nginx config appends to
  `X-Forwarded-For` rather than replacing it (the default nginx behavior),
  the app sees two hops: Cloudflare → your nginx → app. Set
  **`TRUST_PROXY=2`** in that case. Verify by logging `req.ip` and
  `req.headers['x-forwarded-for']` for a real request and confirming
  `req.ip` resolves to the actual client IP, not Cloudflare's or your
  nginx's.

## nginx config

```nginx
# /etc/nginx/sites-available/metabsp-api.conf
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Match backend/src/app.js's express.json({ limit: '50mb' }) — nginx's
    # default client_max_body_size (1m) would 413 legitimate requests
    # (media uploads, bulk CSV imports) before they ever reach the app.
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # Correct client-IP/scheme forwarding — this is what TRUST_PROXY=1
        # (single-hop) depends on being accurate.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for Socket.IO's websocket upgrade (backend/src/socket.js)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;   # keep long-lived websocket connections open
    }

    location /webhook {
        # Meta's webhook — no cookies/auth headers to worry about forwarding,
        # but keep the same proxy headers for HMAC/signature-relevant
        # logging and the rate limiter.
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`proxy_add_x_forwarded_for` **appends** to any existing
`X-Forwarded-For` header rather than replacing it — this is what makes the
Cloudflare-behind-nginx hop count become 2 instead of 1, since Cloudflare's
own client IP gets appended to, not overwritten by, this directive.

If you're running multiple backend instances on the same host or pointing
at a container, replace `proxy_pass http://127.0.0.1:5000` with an
`upstream` block load-balancing across them — the Socket.IO Redis adapter
(`backend/src/socket.js`) is exactly what makes that safe for real-time
features, not just REST.

## Let's Encrypt / certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot's nginx plugin edits the `server` block above in place to add the
`ssl_certificate`/`ssl_certificate_key` directives and the HTTP→HTTPS
redirect automatically; the config above already shows what it produces so
you can write it by hand if you'd rather not have certbot mutate the file.
Renewal is handled by the certbot systemd timer/cron entry installed
alongside it — confirm with `sudo certbot renew --dry-run`.

## Cloudflare

If you put Cloudflare in front of nginx:

1. **Proxy mode ("orange cloud") on**, not "DNS only" — otherwise you get
   none of Cloudflare's edge caching/DDoS protection and the origin IP is
   exposed directly in DNS.
2. **SSL/TLS mode: "Full (strict)"** — requires your origin nginx to
   present a valid certificate (the Let's Encrypt one above works, or use a
   Cloudflare Origin CA certificate instead, which is simpler to provision
   and doesn't need public ACME validation). Do **not** use "Flexible" —
   that terminates TLS at Cloudflare and talks plaintext HTTP to your
   origin, which would leak JWTs and webhook payloads on that hop.
3. **Cache rules that bypass `/api/*` and `/webhook`** — Cloudflare's
   default cache rules only cache static-looking paths, but if you have a
   broader "Cache Everything" page rule active for this zone, explicitly
   exclude the API surface: create a Cache Rule (or a legacy Page Rule)
   matching `api.yourdomain.com/api/*` and `api.yourdomain.com/webhook*`
   with **Cache Level: Bypass**. Caching authenticated JSON responses or
   Meta's webhook POSTs would serve stale/wrong data to other users and
   could break webhook delivery entirely (Meta expects a fresh response per
   request, not a cached one).
4. Remember the resulting hop count: Cloudflare → your nginx → app is two
   hops, so `TRUST_PROXY=2`, not `1`. If you later remove Cloudflare (DNS
   only, or point the domain elsewhere) and go back to nginx being the
   sole proxy, that changes back to `TRUST_PROXY=1` — this is an
   environment-specific value, not something to hardcode and forget.

## Next steps

- [SCALING.md](./SCALING.md) for load-balancing across multiple app
  instances instead of the single `proxy_pass` target above.
- [MONITORING.md](./MONITORING.md) for treating nginx/Cloudflare access
  logs as a monitoring input alongside the app's own pino logs.
