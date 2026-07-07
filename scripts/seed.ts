/**
 * `npm run seed` — load data/seeds/*.json into the configured engine.
 *
 * Provenance-chained, content-addressed, idempotent: re-running an
 * unchanged seed writes nothing. Ends with verify() because a seed run
 * that can't prove integrity didn't happen.
 */

import { CAMPAIGNS } from "../campaigns";
import { loadConfig } from "../src/server/config";
import { createDb, ensureDatabase } from "../src/server/db";
import { seedAll } from "../src/server/seed";

const cfg = loadConfig();
const db = createDb(cfg);

const started = Date.now();
console.log(`⬡ seeding ${cfg.nedbDb} @ ${cfg.nedbUrl} from ${cfg.seedDir}`);

const ok = await ensureDatabase(db, cfg.nedbDb);
if (!ok) {
  console.error("✗ engine unreachable — is nedbd running?");
  process.exit(1);
}

const before = await db.seq();
const result = await seedAll(db, Object.values(CAMPAIGNS), cfg.seedDir);
const after = await db.seq();

for (const s of result.summaries) {
  console.log(
    `  ${s.file}: salon=${s.salonHandle} identities=${s.identities} menus=${s.serviceMenus} (${s.runId})`,
  );
}
console.log(`  cities: ${result.cities} · indexes: ${result.indexes.join(", ")}`);
console.log(`  writes this run: ${after - before} (0 = idempotent no-op)`);

const v = await db.verify();
if (!v.ok) {
  console.error(`✗ verify FAILED — tampered: ${v.tampered.join(", ")}`);
  process.exit(1);
}
const checked = v.objects_checked != null ? `${v.objects_checked} objects checked, ` : "";
console.log(
  `✓ verify ok — tamper-evident, ${checked}head ${v.head.slice(0, 12)}… (${Date.now() - started}ms)`,
);
