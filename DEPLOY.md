# Deploy — three storefronts, one box

One build, three processes, nginx maps domain → port. Everything below is
idempotent; re-running a step never breaks a working deployment.

```
aveda-salon-orlando.com → :3201   (SALON_CAMPAIGN=orlando)
aveda-salon.com         → :3202   (SALON_CAMPAIGN=national)
salon-near-me.com       → :3203   (SALON_CAMPAIGN=directory)
                 all →  nedbd :7070 (NEDB_DB=salon, token-gated, encrypted)
```

## Prerequisites

- Node 20+, npm
- A running **nedbd** (`pip install nedb-engine`) with `NEDBD_TOKEN` set and
  `NEDB_TMK` encryption on — the engine daemon already serving this VPS works;
  the platform only adds a database (`salon`), not a service
- DNS: all three domains on Cloudflare, orange cloud on
- TLS posture (locked decision 4, 2026-07-07): **Cloudflare Flexible** —
  edge terminates TLS, edge→origin is port 80, matching the existing VPS.
  Full (Strict) + origin certs is queued hardening; when flipped, add 443
  server blocks to `deploy/nginx/salon-platform.conf`

## First deploy

```bash
cd ~ && git clone https://github.com/Eth-Interchained/salon-platform.git
cd salon-platform
npm ci                               # pnpm install works too — npm lockfile is canonical
npm run build                        # ONE build serves all three

# per-campaign env: fill REPLACE_ME (NEDB_TOKEN, SALON_ADMIN_TOKEN)
$EDITOR deploy/orlando.env deploy/national.env deploy/directory.env

# SEED — one run serves all three storefronts (shared database).
# Content-addressed + idempotent: re-running an unchanged seed writes 0.
# Ends with a verify() gate; expect "✓ verify ok — tamper-evident".
set -a; . deploy/orlando.env; set +a
npm run seed

# systemd (adjust WorkingDirectory/EnvironmentFile paths if not /root)
sudo cp deploy/systemd/salon-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now salon-orlando salon-national salon-directory

# nginx — through Mail-in-a-Box's custom config hook (MIAB manages nginx;
# never drop files into sites-enabled directly)
sudo cp deploy/nginx/salon-platform.conf /etc/nginx/conf.d/salon-platform.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Verify (never claim green without this)

```bash
for p in 3201 3202 3203; do curl -s localhost:$p/api/health | python3 -m json.tool | head -8; done
curl -s localhost:3201/robots.txt          # campaign-driven, sitemap line on its own origin
curl -s localhost:3202/sitemap.xml         # honest skeleton — homepage only
# then from outside: each domain's / shows ITS brand — the boot banner and
# journalctl -u salon-<campaign> -f name the campaign in every log line
```

## Update

```bash
cd ~/salon-platform && git pull origin main
npm ci && npm run build
set -a; . deploy/orlando.env; set +a
npm run seed                         # no-op unless seed files changed
sudo systemctl restart salon-orlando salon-national salon-directory
for p in 3201 3202 3203; do curl -sf localhost:$p/api/health >/dev/null && echo ":$p ok"; done
```

**pnpm shops / nvm installs**: the systemd units call `/usr/bin/env npm run start` —
if npm isn't on root's system PATH, swap in `pnpm` or an absolute node path in
the three unit files (`status=203/EXEC` in journalctl is that exact tell).

## Rollback

- **Code**: `git revert` the merge on main (never force-push), redeploy as above.
- **Content** (Phase 1+): engine history is the rollback — `AS OF` any document's
  prior version and re-put; nothing is ever lost.

## Blast radius

Each storefront is its own unit: a bad restart of one leaves the other two
serving. The engine is shared by design (one database, campaign-tagged
content, cross-entity DAG edges).
