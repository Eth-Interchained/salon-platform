/**
 * SEO builders — unit suite. JSON-LD is asserted against the REAL Mint
 * seed entity (no fixture drift: the seed file IS the fixture).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CAMPAIGNS } from "../campaigns";
import { buildHead, pageTitle } from "../src/lib/seo/head";
import { breadcrumbsJsonLd, hairSalonJsonLd, type SalonEntityLike } from "../src/lib/seo/jsonld";
import { parseSeedFile } from "../src/server/seed";
import { labelFor } from "../src/server/pages";

const orlando = CAMPAIGNS.orlando;
const ORIGIN = "https://aveda-salon-orlando.com";
const { seed } = parseSeedFile("data/seeds/mint-on-the-avenue.json");
const entity = seed.salon.entity as SalonEntityLike;

test("pageTitle slots into the campaign titleTemplate", () => {
  assert.equal(
    pageTitle({ title: "Services", description: "", path: "/services" }, orlando),
    "Services | Aveda Salon Orlando",
  );
});

test("buildHead: canonical on campaign origin, description, OG, escaping", () => {
  const head = buildHead(
    { title: `Balayage & "Color"`, description: "Editorial color <on> Park Avenue", path: "/services/hair-color" },
    orlando,
    ORIGIN,
  );
  assert.ok(head.includes(`<link rel="canonical" href="${ORIGIN}/services/hair-color">`));
  assert.ok(head.includes("&amp;"), "title escaped");
  assert.ok(head.includes("&lt;on&gt;"), "description escaped");
  assert.ok(head.includes(`og:site_name" content="Aveda Salon Orlando"`));
  assert.ok(!head.includes(`name="robots"`), "indexable by default");
  const held = buildHead({ title: "x", description: "y", path: "/z", noindex: true }, orlando, ORIGIN);
  assert.ok(held.includes(`content="noindex, follow"`));
});

test("HairSalon JSON-LD from the REAL Mint entity — honest fields only", () => {
  const ld = hairSalonJsonLd(entity, ORIGIN) as Record<string, unknown>;
  assert.equal(ld["@type"], "HairSalon");
  assert.equal(ld.name, "Mint on the Avenue");
  assert.equal(ld.telephone, "+1-407-645-2264");
  const addr = ld.address as Record<string, string>;
  assert.equal(addr.streetAddress, "228 N Park Ave");
  assert.equal(addr.addressLocality, "Winter Park");
  assert.equal(addr.postalCode, "32789");
  const geo = ld.geo as Record<string, number>;
  assert.equal(geo.latitude, 28.5992879);
  // Tue–Fri 9–20 + Sat 9–18 have open/close; Sun & Mon are by-appointment
  // notes and MUST be omitted (no honest schema encoding for them)
  const hours = ld.openingHoursSpecification as { dayOfWeek: string }[];
  assert.equal(hours.length, 5);
  assert.ok(!hours.some((h) => h.dayOfWeek === "Sunday" || h.dayOfWeek === "Monday"));
  // Google's own rating is NEVER self-marked-up (spec §14 risk 7)
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(ld.review, undefined);
  // brand from real data
  const brands = ld.brand as { name: string }[];
  assert.equal(brands[0]?.name, "Aveda");
  // sameAs carries the real Maps URL
  assert.ok((ld.sameAs as string[]).some((u) => u.includes("maps.google.com")));
});

test("JSON-LD never invents: empty entity yields only type + url", () => {
  const ld = hairSalonJsonLd({}, ORIGIN) as Record<string, unknown>;
  assert.deepEqual(Object.keys(ld).sort(), ["@context", "@type", "url"]);
});

test("BreadcrumbList positions and absolute items", () => {
  const ld = breadcrumbsJsonLd(
    [
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
    ],
    ORIGIN,
  ) as { itemListElement: { position: number; item: string }[] };
  assert.equal(ld.itemListElement[0].position, 1);
  assert.equal(ld.itemListElement[1].item, `${ORIGIN}/services`);
});

test("labelFor: curated labels, graceful fallback", () => {
  assert.equal(labelFor("hair-color"), "Hair Color");
  assert.equal(labelFor("mint-men"), "Mint Men");
  assert.equal(labelFor("some-new-thing"), "Some New Thing");
});
