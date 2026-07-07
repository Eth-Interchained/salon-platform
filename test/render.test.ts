/**
 * Render builders — unit suite. robots.txt and sitemap.xml are pure
 * functions of (campaign, origin); they're tested as such.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CAMPAIGN_IDS, CAMPAIGNS } from "../campaigns";
import { buildRobots, buildSitemap, campaignOrigin } from "../src/server/render";

test("campaignOrigin: PUBLIC_ORIGIN wins, canonical domain is the fallback", () => {
  const orl = CAMPAIGNS.orlando;
  assert.equal(
    campaignOrigin({ publicOrigin: "https://staging.example.com/" }, orl),
    "https://staging.example.com", // trailing slash stripped
  );
  assert.equal(campaignOrigin({ publicOrigin: undefined }, orl), "https://aveda-salon-orlando.com");
});

test("robots.txt: open posture lists config disallows + sitemap line", () => {
  for (const id of CAMPAIGN_IDS) {
    const c = CAMPAIGNS[id];
    const origin = `https://${c.domain}`;
    const robots = buildRobots(c, origin);
    assert.ok(robots.startsWith("User-agent: *\n"), id);
    for (const path of c.seo.robots.disallow) {
      assert.ok(robots.includes(`Disallow: ${path}\n`), `${id}: missing Disallow ${path}`);
    }
    assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), `${id}: sitemap line`);
    // open posture never emits a bare "Disallow: /"
    assert.ok(!/^Disallow: \/$/m.test(robots), `${id}: must not block everything`);
  }
});

test("robots.txt: holdback posture blocks everything", () => {
  const held = {
    ...CAMPAIGNS.orlando,
    seo: {
      ...CAMPAIGNS.orlando.seo,
      robots: { allowAll: false, disallow: [] },
    },
  };
  const robots = buildRobots(held, "https://aveda-salon-orlando.com");
  assert.ok(/^Disallow: \/$/m.test(robots));
});

test("sitemap.xml: valid urlset, xml-escaped, no invented lastmod", () => {
  const xml = buildSitemap([
    "https://aveda-salon-orlando.com/",
    "https://aveda-salon-orlando.com/services/hair-color",
    "https://aveda-salon-orlando.com/a&b",
  ]);
  assert.ok(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`));
  assert.ok(xml.includes(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`));
  assert.ok(xml.includes(`<loc>https://aveda-salon-orlando.com/services/hair-color</loc>`));
  assert.ok(xml.includes(`<loc>https://aveda-salon-orlando.com/a&amp;b</loc>`), "xml escaping");
  assert.ok(!xml.includes("<lastmod>"), "no invented lastmod");
});
