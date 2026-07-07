/**
 * Server config — unit suite. Fail-fast doctrine under test: a process
 * that doesn't know which storefront it is must refuse to boot.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig, validateConfig } from "../src/server/config";

test("defaults: port 3201, db 'salon', local nedbd", () => {
  const cfg = loadConfig({ SALON_CAMPAIGN: "orlando" } as NodeJS.ProcessEnv);
  assert.equal(cfg.port, 3201);
  assert.equal(cfg.nedbDb, "salon");
  assert.equal(cfg.nedbUrl, "http://127.0.0.1:7070");
  assert.equal(cfg.campaign?.id, "orlando");
});

test("SALON_API_PORT is canonical, PORT is the fallback", () => {
  const canonical = loadConfig({
    SALON_CAMPAIGN: "national",
    SALON_API_PORT: "3202",
    PORT: "9999",
  } as NodeJS.ProcessEnv);
  assert.equal(canonical.port, 3202);
  const fallback = loadConfig({
    SALON_CAMPAIGN: "national",
    PORT: "9999",
  } as NodeJS.ProcessEnv);
  assert.equal(fallback.port, 9999);
});

test("unset SALON_CAMPAIGN loads (campaign null) but fails validation", () => {
  const cfg = loadConfig({} as NodeJS.ProcessEnv);
  assert.equal(cfg.campaign, null);
  const problems = validateConfig(cfg, {} as NodeJS.ProcessEnv);
  assert.ok(problems.some((p) => p.includes("SALON_CAMPAIGN is required")));
});

test("unknown SALON_CAMPAIGN throws at load (fail fast)", () => {
  assert.throws(
    () => loadConfig({ SALON_CAMPAIGN: "mars" } as NodeJS.ProcessEnv),
    /Unknown SALON_CAMPAIGN/,
  );
});

test("production requires PUBLIC_ORIGIN", () => {
  const cfg = loadConfig({ SALON_CAMPAIGN: "orlando" } as NodeJS.ProcessEnv);
  const problems = validateConfig(cfg, { NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.ok(problems.some((p) => p.includes("PUBLIC_ORIGIN is required in production")));
  const ok = loadConfig({
    SALON_CAMPAIGN: "orlando",
    PUBLIC_ORIGIN: "https://aveda-salon-orlando.com",
  } as NodeJS.ProcessEnv);
  const none = validateConfig(ok, { NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.ok(!none.some((p) => p.includes("PUBLIC_ORIGIN")));
});

test("dev does not require PUBLIC_ORIGIN", () => {
  const cfg = loadConfig({ SALON_CAMPAIGN: "directory" } as NodeJS.ProcessEnv);
  const problems = validateConfig(cfg, {} as NodeJS.ProcessEnv);
  assert.equal(problems.length, 0);
});
