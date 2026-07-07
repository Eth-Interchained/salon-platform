/**
 * Boot: load .env (real env wins) → validate → ensure database → listen.
 *
 * One process = one storefront. The boot banner always states which
 * campaign this process IS, so a mis-deployed domain is caught by eye
 * in the first log line, not by a customer.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createApp } from "./src/server/app";
import { loadConfig, validateConfig } from "./src/server/config";
import { ensureDatabase } from "./src/server/db";

// ── .env loader — real environment variables always win ─────────────────────
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

const config = loadConfig();
const problems = validateConfig(config);
if (problems.length > 0) {
  console.error("\x1b[31m[salon] refusing to boot:\x1b[0m");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

const campaign = config.campaign;
if (!campaign) process.exit(1); // unreachable — validateConfig covered it

const { app, db } = createApp(config);

void ensureDatabase(db, config.nedbDb).then(() => {
  app.listen(config.port, () => {
    console.log("\x1b[36m⬡ salon-platform\x1b[0m");
    console.log(`  campaign : ${campaign.id}`);
    console.log(`  brand    : ${campaign.brandName}`);
    console.log(`  domain   : ${campaign.domain}`);
    console.log(`  api      : http://localhost:${config.port}`);
    console.log(`  nedb     : ${config.nedbUrl} (db: ${config.nedbDb})`);
  });
});
