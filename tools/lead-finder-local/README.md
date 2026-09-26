# MetaBSP Lead Finder — Local PC Agent

This mode runs the Google Maps scraper on a Windows office PC while MetaBSP stays in the cloud.

## Why this mode

- No second Render service.
- No Cloudflare Tunnel, static IP, router port forwarding, or public scraper port.
- The PC only makes outbound HTTPS calls to MetaBSP.
- The scraper API stays on `127.0.0.1:8080`.
- When the PC is off, the Lead Finder UI shows **Office PC Offline** and disables new searches.

## Server configuration

Set these environment variables on the MetaBSP Render service:

```text
LEAD_FINDER_MODE=local_agent
LEAD_FINDER_AGENT_TOKEN=<long-random-secret>
```

`LEAD_SCRAPER_URL` is not needed in local-agent mode.

## Windows installation

Run PowerShell as Administrator and execute the installer with the same agent token configured on Render:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -AgentToken '<same-secret-as-render>'
```

The installer:

1. installs/checks Docker Desktop,
2. downloads the pinned `gosom/google-maps-scraper:v1.15.0` image,
3. binds the scraper only to `127.0.0.1:8080`,
4. stores the MetaBSP URL + agent token in `C:\ProgramData\MetaBSPLeadFinder\config.json`,
5. registers **MetaBSP Lead Finder Agent** as a Windows Scheduled Task at logon,
6. starts the agent immediately.

The agent starts Docker Desktop when needed, keeps the scraper running, checks MetaBSP for one queued search at a time, runs it locally, and uploads the result CSV back to MetaBSP.

## Normal operation

1. Turn on/sign in to the office PC.
2. Docker Desktop and the agent start automatically.
3. Open MetaBSP → **Business Lead Finder**.
4. Wait for the green **Office PC Online** status.
5. Run the search normally.

If the PC is off or offline, no scraper is exposed and MetaBSP will show the agent as offline.

## Security

Treat `LEAD_FINDER_AGENT_TOKEN` like a password. Do not commit it to GitHub or share it publicly. The server compares it using a timing-safe comparison. The local scraper itself is never bound to a public network interface.
