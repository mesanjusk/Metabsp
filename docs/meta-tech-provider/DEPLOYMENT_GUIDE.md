# Deployment guide — start here

This is a pointer doc. The full, per-platform deployment guides live in
`docs/deployment/`:

- [`PRODUCTION_ARCHITECTURE.md`](../deployment/PRODUCTION_ARCHITECTURE.md) — read this first
- [`AWS_DEPLOYMENT.md`](../deployment/AWS_DEPLOYMENT.md)
- [`AZURE_DEPLOYMENT.md`](../deployment/AZURE_DEPLOYMENT.md)
- [`GCP_DEPLOYMENT.md`](../deployment/GCP_DEPLOYMENT.md)
- [`DOCKER_DEPLOYMENT.md`](../deployment/DOCKER_DEPLOYMENT.md)
- [`KUBERNETES_DEPLOYMENT.md`](../deployment/KUBERNETES_DEPLOYMENT.md)
- [`NGINX_SSL_CLOUDFLARE.md`](../deployment/NGINX_SSL_CLOUDFLARE.md)
- [`REDIS_AND_MONGODB_OPS.md`](../deployment/REDIS_AND_MONGODB_OPS.md)
- [`MONITORING.md`](../deployment/MONITORING.md)
- [`SCALING.md`](../deployment/SCALING.md)
- [`DISASTER_RECOVERY.md`](../deployment/DISASTER_RECOVERY.md)
- [`HIGH_AVAILABILITY.md`](../deployment/HIGH_AVAILABILITY.md)

Plus, already in the repo before this documentation pass:

- [`docs/BACKUP_RESTORE.md`](../BACKUP_RESTORE.md) — backup/restore
  strategy and the `verify-restore.js` drill script
- [`backend/loadtest/README.md`](../../backend/loadtest/README.md) — k6
  and autocannon load testing

Once your infrastructure is up, come back to
[`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) for the
Meta-Tech-Provider-specific go-live checklist (App Review, webhook setup,
System User tokens, the known Baileys-Campaigns compliance item) that
sits on top of the pure infrastructure concerns those guides cover.
