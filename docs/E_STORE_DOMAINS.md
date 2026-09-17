# E-Store public URLs and domains

Every store has three possible customer-facing addresses:

1. `https://meta.sanjusk.in/shop/<slug>` works immediately after the store is published.
2. `https://<slug>.store.meta.sanjusk.in` is allocated automatically. It needs one platform-wide wildcard DNS and Render setup.
3. A business-owned domain such as `shop.example.com` is connected from **E-Store → Store settings**.

## One-time platform subdomain setup

In Render, add `*.store.meta.sanjusk.in` as a wildcard custom domain. Render supplies two verification targets for the wildcard certificate. In GoDaddy DNS for `sanjusk.in`, create the wildcard CNAME plus the `_acme-challenge` and `_cf-custom-hostname` CNAME records exactly as Render shows them. The wildcard means signup only reserves a unique store slug in MongoDB; it does not call GoDaddy for every customer.

Set these Render environment variables:

- `STORE_SUBDOMAIN_BASE=store.meta.sanjusk.in`
- `STORE_DOMAIN_CNAME_TARGET=metabsp.onrender.com`
- `RENDER_SERVICE_ID=<the metabsp Render service id>`
- `RENDER_API_KEY=<restricted Render API key>`

Confirm the service's actual `onrender.com` hostname before setting `STORE_DOMAIN_CNAME_TARGET`.

## Customer-owned custom domains

The recommended address is a subdomain such as `shop.customer.com`. The store owner enters it in Store settings and saves. MetaBSP generates a unique TXT verification token and displays the two DNS records required at GoDaddy:

- CNAME for the store host to `STORE_DOMAIN_CNAME_TARGET`
- TXT at `_metabsp-verification.<custom-domain>` with the generated token

The **Verify domain** action checks both public DNS records. Only then does the server use the Render API to add the hostname and wait for Render's managed HTTPS certificate. A custom hostname is routed only after Render reports it verified.
