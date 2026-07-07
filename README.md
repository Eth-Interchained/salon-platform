# ⬡ Portal Salon Platform

**One Portal application. Many salon storefronts. Everything configurable.**

Not three websites — one codebase whose behavior (brand, routes, SEO posture,
content strategy) is selected by campaign configuration at process start.

| Campaign | Domain | Mission |
|---|---|---|
| `orlando` | aveda-salon-orlando.com | Central Florida local search → booked appointments |
| `national` | aveda-salon.com | Topical authority — answer every Aveda/hair question |
| `directory` | salon-near-me.com | The Portal-powered directory for independent salons |

Built on the Interchained stack, exactly the way we'd tell a customer to build:

> **NEDB stores knowledge. Portal renders experiences. Links publishes identity.**

- **[Portal](https://github.com/interchained/Portal)** — the agent-native web framework: living contract (`app.contract.ts`), file-based routes, audit agents.
- **[NEDB](https://github.com/eth-interchained/nedb)** — the versioned, time-traveling, causally-provable engine. ALL state lives in one running `nedbd`; there is no other database.
- **[NEDB Links](https://github.com/eth-interchained/nedb-links)** — the identity layer: salons, stylists, services, and cities are Identity Manifests.

Engine capability equals product feature: `AS OF` is page history, `VALID AS OF`
is scheduled publishing, `TRACE` is content provenance, append-only events with
NQL `GROUP BY` are analytics.

## Quickstart

```bash
# 1. A running engine (all state lives here)
pip install nedb-engine
nedbd --data ./nedb-data          # http://127.0.0.1:7070

# 2. The platform
npm install
cp .env.example .env              # pick your campaign
npm run dev                       # Vite client + Express API, ports move together
```

Boot another storefront from the same working tree: change `SALON_CAMPAIGN`
in `.env` (the dev-api wrapper restarts the API automatically).

## Configuration

Real environment variables always win over `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `SALON_CAMPAIGN` | — (**required**) | which storefront this process IS: `orlando` \| `national` \| `directory` |
| `PUBLIC_ORIGIN` | — (required in production) | canonical URLs, sitemaps, share links |
| `SALON_API_PORT` | `3201` | Express port (canonical; `PORT` is the fallback) |
| `VITE_PORT` | `3000` | dev client port |
| `NEDB_URL` | `http://127.0.0.1:7070` | the running nedbd |
| `NEDB_DB` | `salon` | one database shared by all campaigns |
| `NEDB_TOKEN` | — | when nedbd is token-gated |
| `SALON_ADMIN_TOKEN` | — | pre-admin write gate |
| `SEED_DIR` | `./data/seeds` | salon seed files (see below) |
| `AIASSIST_BASE_URL` / `AIASSIST_API_KEY` | — | AI content pipeline (Phase 3), gracefully absent |

## Seeds — bring your own salon

`data/seeds/salon.template.json` is the generic contract: copy it, fill it with
**real data** (cite your sources — never invented), and the deploy seeder loads
it into NEDB with provenance. `mint-on-the-avenue.json` is the first instance.
Campaigns reference salons by handle (`anchorSalonHandle`) — deploying this
platform for a different salon is a seed file and one config line.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite client + API together (dev-api restarts on `.env` edits) |
| `npm run build` / `start` | `portal build` → production Express serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit suites (campaigns, config) |
| `npm run test:api` | live suite vs a real nedbd — no mocks |
| `npm run audit` / `guard` | Portal contract checks |

## License

GPL-3.0-or-later · © INTERCHAINED LLC
