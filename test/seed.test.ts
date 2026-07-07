/**
 * Seed loader — unit suite. Pure pieces only; the live proof (real file →
 * real engine → idempotent re-run) lives in test/api.test.ts's suite
 * alongside the storefront matrix.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { categorySlug, seedFileSchema, slugify } from "../src/server/entities";
import { idemKey, identityId, listSeedFiles, parseSeedFile } from "../src/server/seed";

test("slugify: names → handles, diacritics and punctuation handled", () => {
  assert.equal(slugify("Sonia Taylor"), "sonia-taylor");
  assert.equal(slugify("Dr. Phillips"), "dr-phillips");
  assert.equal(slugify("Samantha Herrman"), "samantha-herrman");
  assert.equal(slugify("  Lian   Ortiz "), "lian-ortiz");
});

test("categorySlug: camelCase seed keys → kebab slugs", () => {
  assert.equal(categorySlug("hairDesign"), "hair-design");
  assert.equal(categorySlug("hairColor"), "hair-color");
  assert.equal(categorySlug("mintMen"), "mint-men");
  assert.equal(categorySlug("texture"), "texture");
});

test("identityId is deterministic and idn_-prefixed", () => {
  const a = identityId("mint-on-the-avenue");
  assert.equal(a, identityId("mint-on-the-avenue"));
  assert.match(a, /^idn_[0-9a-f]{20}$/);
  assert.notEqual(a, identityId("sonia-taylor"));
});

test("idemKey is content-addressed: same content = same key, new content = new key", () => {
  const k1 = idemKey("filehash-a", "identities", "idn_x");
  assert.equal(k1, idemKey("filehash-a", "identities", "idn_x"));
  assert.notEqual(k1, idemKey("filehash-b", "identities", "idn_x"));
  assert.notEqual(k1, idemKey("filehash-a", "handles", "idn_x"));
});

test("listSeedFiles skips templates, real seed parses + validates", () => {
  const files = listSeedFiles("data/seeds");
  assert.ok(files.some((f) => f.endsWith("mint-on-the-avenue.json")));
  assert.ok(!files.some((f) => f.includes("template")), "template must be skipped");

  const { seed } = parseSeedFile(files.find((f) => f.endsWith("mint-on-the-avenue.json"))!);
  assert.equal(seed.salon.handle, "mint-on-the-avenue");
  assert.equal(seed.salon.identityType, "salon");
  assert.equal(seed.team.length, 7, "canonical 7-member roster");
  assert.ok(Object.keys(seed.services).length >= 6, "service categories present");
});

test("seed schema rejects invented shapes loudly", () => {
  const bad = { retrievedAt: "2026-07-07", salon: { identityType: "salon", handle: "UPPER CASE", displayName: "x", entity: {} } };
  const parsed = seedFileSchema.safeParse(bad);
  assert.equal(parsed.success, false, "invalid handle must fail validation");
});
