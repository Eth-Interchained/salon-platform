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
    };
    assert.equal(c.campaignId, id);
    assert.equal(c.brandName, CAMPAIGNS[id].brandName, `${id}: brand follows campaign`);
    assert.equal(c.domain, CAMPAIGNS[id].domain);
    assert.ok(Array.isArray(c.nav) && c.nav.length > 0, `${id}: nav present`);
  }
});

test("unknown /api/* routes 404 as JSON, not the SPA shell", async () => {
  const base = await bootCampaign("orlando");
  const r = await fetch(`${base}/api/definitely-not-a-route`);
  assert.equal(r.status, 404);
  const j = (await r.json()) as { error: string };
  assert.equal(j.error, "not found");
});
