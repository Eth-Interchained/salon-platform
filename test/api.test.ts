/**
 * Live suite — the REAL app against a REAL nedbd. No mocks; the engine
 * is the system under test as much as the app is (house rule, inherited
 * from NEDB Links).
 *
 * This is the three-storefront matrix in embryo: the SAME code boots once
 * per campaign in this one process, and each boot must identify as its own
 * storefront. PR-3 lifts this to a CI matrix.
 *
 * Expects nedbd at NEDB_TEST_URL (default http://127.0.0.1:8484):
 *   pip install nedb-engine
 *   python3 -m nedb.server --host 127.0.0.1 --port 8484 --data /tmp/salon-test
 */

import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

import { CAMPAIGN_IDS, CAMPAIGNS } from "../campaigns";
import { createApp } from "../src/server/app";
import { loadConfig } from "../src/server/config";
import { ensureDatabase } from "../src/server/db";

const NEDB_TEST_URL = process.env.NEDB_TEST_URL || "http://127.0.0.1:8484";
const TEST_DB = `salon_ci_${Date.now().toString(36)}`;

before(async () => {
  try {
    const r = await fetch(`${NEDB_TEST_URL}/health`);
    if (!r.ok) throw new Error(`health ${r.status}`);
  } catch (err) {
    throw new Error(
      `live suite needs a running nedbd at ${NEDB_TEST_URL} — start one with:\n` +
        `  pip install nedb-engine && python3 -m nedb.server --host 127.0.0.1 --port 8484 --data /tmp/salon-test\n` +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
  }
});

const servers: Server[] = [];
after(() => {
  for (const s of servers) s.close();
});

async function bootCampaign(id: string): Promise<string> {
  const cfg = loadConfig({
    SALON_CAMPAIGN: id,
    NEDB_URL: NEDB_TEST_URL,
    NEDB_DB: TEST_DB,
  } as NodeJS.ProcessEnv);
  const { app, db } = createApp(cfg);
  const ensured = await ensureDatabase(db, TEST_DB);
  assert.ok(ensured, `ensureDatabase failed for ${id}`);
  const server = app.listen(0);
  servers.push(server);
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no ephemeral port");
  return `http://127.0.0.1:${addr.port}`;
}

test("the same build boots as all three storefronts", async () => {
  for (const id of CAMPAIGN_IDS) {
    const base = await bootCampaign(id);

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200, `${id}: health status`);
    const h = (await health.json()) as {
      salon: string;
      campaign: string;
      domain: string;
      nedb: { ok: boolean; version?: string };
      db: string;
    };
    assert.equal(h.salon, "ok", id);
    assert.equal(h.campaign, id, `${id}: process identifies as its campaign`);
    assert.equal(h.domain, CAMPAIGNS[id].domain, id);
    assert.equal(h.nedb.ok, true, `${id}: engine reachable (v${h.nedb.version ?? "?"})`);
    assert.equal(h.db, TEST_DB, id);

    const config = await fetch(`${base}/api/config`);
    assert.equal(config.status, 200, `${id}: config status`);
    const c = (await config.json()) as {
      campaignId: string;
      brandName: string;
      domain: string;
      nav: unknown[];
      primaryGoal: string;
    };
    assert.equal(c.campaignId, id);
    assert.equal(c.brandName, CAMPAIGNS[id].brandName, `${id}: brand follows campaign`);
    assert.equal(c.domain, CAMPAIGNS[id].domain);
    assert.ok(Array.isArray(c.nav) && c.nav.length > 0, `${id}: nav present`);
    assert.equal(c.primaryGoal, CAMPAIGNS[id].conversion.primaryGoal, `${id}: primaryGoal`);

    // server-rendered public surfaces (PR-2 render skeleton)
    const robots = await fetch(`${base}/robots.txt`);
    assert.equal(robots.status, 200, `${id}: robots status`);
    assert.match(robots.headers.get("content-type") ?? "", /text\/plain/, id);
    const robotsBody = await robots.text();
    assert.ok(
      robotsBody.includes(`Sitemap: https://${CAMPAIGNS[id].domain}/sitemap.xml`),
      `${id}: robots sitemap line on the campaign's own origin`,
    );

    const sitemap = await fetch(`${base}/sitemap.xml`);
    assert.equal(sitemap.status, 200, `${id}: sitemap status`);
    assert.match(sitemap.headers.get("content-type") ?? "", /application\/xml/, id);
    const sitemapBody = await sitemap.text();
    assert.ok(
      sitemapBody.includes(`<loc>https://${CAMPAIGNS[id].domain}/</loc>`),
      `${id}: sitemap homepage on the campaign's own origin`,
    );
  }
});

test("unknown /api/* routes 404 as JSON, not the SPA shell", async () => {
  const base = await bootCampaign("orlando");
  const r = await fetch(`${base}/api/definitely-not-a-route`);
  assert.equal(r.status, 404);
  const j = (await r.json()) as { error: string };
  assert.equal(j.error, "not found");
});

test("seed loader: real file → real engine, provenance-chained, idempotent", async () => {
  const { createDb } = await import("../src/server/db");
  const { seedAll } = await import("../src/server/seed");
  const { getIdentityByHandle, listTeam, listServiceMenus, getCity } = await import(
    "../src/server/entities"
  );

  const db = createDb({ nedbUrl: NEDB_TEST_URL, nedbDb: TEST_DB, nedbToken: undefined });

  // first run — Mint's real data lands
  const result = await seedAll(db, Object.values(CAMPAIGNS), "data/seeds");
  assert.equal(result.summaries.length, 1, "one real seed file");
  assert.equal(result.summaries[0].salonHandle, "mint-on-the-avenue");
  assert.equal(result.summaries[0].identities, 8, "1 salon + 7 team");
  assert.ok(result.summaries[0].serviceMenus >= 6, "menu categories");
  assert.equal(result.cities, 13, "13 unique cities across campaigns (directory ⊂ orlando)");

  // reads the render plane will use
  const salon = await getIdentityByHandle(db, "mint-on-the-avenue");
  assert.ok(salon, "salon resolves via handle");
  assert.equal(salon?.identityType, "salon");
  const nap = (salon?.entity as { nap?: { phone?: string } })?.nap;
  assert.equal(nap?.phone, "+1-407-645-2264", "real NAP data intact");

  // flat-key WHERE queries — the Phase-1 relation model, proven on the engine
  const team = await listTeam(db, "mint-on-the-avenue");
  assert.equal(team.length, 7, "WHERE salonHandle + identityType works");
  const menus = await listServiceMenus(db, "mint-on-the-avenue");
  assert.ok(menus.some((m) => m.category === "hair-color"), "hair-color menu present");

  const city = await getCity(db, "dr-phillips");
  assert.equal(city?.name, "Dr. Phillips", "curated city display name");

  // idempotency: re-running the unchanged seed writes NOTHING
  const before = await db.seq();
  await seedAll(db, Object.values(CAMPAIGNS), "data/seeds");
  const after = await db.seq();
  assert.equal(after, before, `re-run must be a no-op (wrote ${after - before})`);

  // and the whole database still proves integrity
  const v = await db.verify();
  assert.equal(v.ok, true, "verify green after seeding");
});
