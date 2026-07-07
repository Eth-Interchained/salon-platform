/**
 * Campaign registry — unit suite. The definitions ARE the product
 * differences, so their invariants are tested like code, because they are.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CAMPAIGN_IDS, CAMPAIGNS, resolveCampaign } from "../campaigns";
import { campaignSchema } from "../src/lib/campaign";

test("exactly three campaigns are registered", () => {
  assert.deepEqual([...CAMPAIGN_IDS].sort(), ["directory", "national", "orlando"]);
});

test("every campaign passes its own schema", () => {
  for (const id of CAMPAIGN_IDS) {
    const parsed = campaignSchema.safeParse(CAMPAIGNS[id]);
    assert.ok(parsed.success, `${id}: ${parsed.success ? "" : parsed.error.message}`);
  }
});

test("locked decision: domains match the spec", () => {
  assert.equal(CAMPAIGNS.orlando.domain, "aveda-salon-orlando.com");
  assert.equal(CAMPAIGNS.national.domain, "aveda-salon.com");
  assert.equal(CAMPAIGNS.directory.domain, "salon-near-me.com");
});

test("orlando targets exactly the 13 locked cities", () => {
  const cities = CAMPAIGNS.orlando.geography?.cities ?? [];
  assert.equal(cities.length, 13);
  const slugs = cities.map((c) => c.slug);
  for (const expected of ["orlando", "winter-park", "maitland", "dr-phillips", "windermere"]) {
    assert.ok(slugs.includes(expected), `missing city: ${expected}`);
  }
  // display names are curated, never slug-derived
  assert.equal(cities.find((c) => c.slug === "dr-phillips")?.name, "Dr. Phillips");
});

test("orlando anchors on Mint on the Avenue", () => {
  assert.equal(CAMPAIGNS.orlando.anchorSalonHandle, "mint-on-the-avenue");
});

test("anti-cannibalization: national never targets local intent", () => {
  const never = CAMPAIGNS.national.contentPlan.internalLinking.neverTargets;
  assert.ok(never.includes("local"));
  assert.ok(never.includes("near-me"));
});

test("every titleTemplate carries the %s slot", () => {
  for (const id of CAMPAIGN_IDS) {
    assert.ok(CAMPAIGNS[id].seo.titleTemplate.includes("%s"), id);
  }
});

test("resolveCampaign fails fast and loud on unknown ids", () => {
  assert.throws(() => resolveCampaign("mars"), /Unknown SALON_CAMPAIGN "mars"/);
  assert.throws(() => resolveCampaign("mars"), /orlando/); // names the known ids
});
