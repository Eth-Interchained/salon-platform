/**
 * `npm run sync:wordpress` — pull published posts from a WP Portal Bridge
 * WordPress site into the configured campaign's articles collection.
 *
 * Content-addressed, idempotent: re-running against an unchanged WordPress
 * writes nothing. Ends with verify(), same discipline as seed.ts.
 *
 * Requires PORTAL_BRIDGE_BASE_URL + PORTAL_TMK (see WordPress Admin →
 * Portal Bridge → Connect Portal Frontend on the source WordPress site).
 */

import { loadConfig } from "../src/server/config";
import { createDb, ensureDatabase } from "../src/server/db";
import { syncWordPressArticles } from "../src/server/wordpress-sync";

const cfg = loadConfig();

if (!cfg.campaign) {
  console.error("✗ SALON_CAMPAIGN is required — which campaign's articles are these?");
  process.exit(1);
}
if (!cfg.wordpressBridgeBaseUrl || !cfg.wordpressBridgeTmk) {
  console.error(
    "✗ PORTAL_BRIDGE_BASE_URL and PORTAL_TMK are required — copy both from the source " +
      "WordPress site's Portal Bridge admin screen (Connect Portal Frontend).",
  );
  process.exit(1);
}

const db = createDb(cfg);
const started = Date.now();

console.log(
  `⬡ syncing WordPress posts from ${cfg.wordpressBridgeBaseUrl} → ${cfg.campaign.id}/articles @ ${cfg.nedbDb}`,
);

const ok = await ensureDatabase(db, cfg.nedbDb);
if (!ok) {
  console.error("✗ engine unreachable — is nedbd running?");
  process.exit(1);
}

try {
  const result = await syncWordPressArticles(db, {
    baseUrl: cfg.wordpressBridgeBaseUrl,
    tmk: cfg.wordpressBridgeTmk,
    campaignId: cfg.campaign.id,
  });

  console.log(
    `  snapshot ${result.snapshotId}: ${result.postsFound} published posts, ` +
      `writes this run: ${result.writesThisRun} (0 = idempotent no-op)`,
  );

  const v = await db.verify();
  if (!v.ok) {
    console.error(`✗ verify FAILED — tampered: ${v.tampered.join(", ")}`);
    process.exit(1);
  }
  const checked = v.objects_checked != null ? `${v.objects_checked} objects checked, ` : "";
  console.log(
    `✓ verify ok — tamper-evident, ${checked}head ${v.head.slice(0, 12)}… (${Date.now() - started}ms)`,
  );
} catch (err) {
  console.error(`✗ WordPress sync failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
