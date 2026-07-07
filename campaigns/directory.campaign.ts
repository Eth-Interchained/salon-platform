/**
 * Campaign 3 — salon-near-me.com
 * Mission: the Portal-powered directory for independent salons.
 * Not another Yelp — verifiable identities, owned by the salons
 * themselves, legible to humans and agents alike.
 *
 * Keyword intent contract (spec §11): this storefront owns COMPARISON
 * and DISCOVERY intent — "best salons in", "salon directory", entity
 * long-tail ("<salon name> <city>"). Hierarchy is data: country → state
 * → city → salon → stylist, all identities and edges, none of it code.
 */

import { defineCampaign } from "../src/lib/campaign";

export const directory = defineCampaign({
  id: "directory",
  domain: "salon-near-me.com",
  brandName: "Salon Near Me",
  mission:
    "Give every independent salon a verifiable, ownable web presence — profile, services, stylists, booking — and give searchers a directory that is actually complete where it counts.",
  theme: { id: "directory" },
  surfaces: ["home", "directory", "search"],
  nav: [
    { label: "Browse", href: "/fl" },
    { label: "Search", href: "/search" },
  ],
  seo: {
    titleTemplate: "%s | Salon Near Me",
    defaultDescription:
      "The independent salon directory — verified profiles, real services and prices, stylists, and booking links. Built city-deep, starting with Central Florida.",
    primaryKeywords: [
      "salon directory",
      "salons in orlando",
      "best salons near me",
      "find a hair salon",
    ],
    organization: {
      type: "WebSite",
      name: "Salon Near Me",
      url: "https://salon-near-me.com",
    },
    sitemapSections: [
      { name: "salons", collection: "identities", where: "identityType = \"salon\"" },
      { name: "cities", collection: "identities", where: "identityType = \"city\"" },
      { name: "pages", collection: "landing_pages" },
    ],
    robots: { allowAll: true, disallow: ["/api", "/admin", "/claim"] },
  },
  geography: {
    country: "US",
    state: "FL",
    cities: [
      { slug: "orlando", name: "Orlando" },
      { slug: "winter-park", name: "Winter Park" },
      { slug: "maitland", name: "Maitland" },
      { slug: "altamonte-springs", name: "Altamonte Springs" },
      { slug: "oviedo", name: "Oviedo" },
      { slug: "winter-garden", name: "Winter Garden" },
      { slug: "lake-mary", name: "Lake Mary" },
      { slug: "longwood", name: "Longwood" },
      { slug: "sanford", name: "Sanford" },
      { slug: "windermere", name: "Windermere" },
    ],
  },
  conversion: {
    primaryGoal: "Salon owner claims a listing",
    successEvents: ["claim_start", "profile_view", "booking_click"],
  },
  contentPlan: {
    collections: ["landing_pages", "faqs"],
    internalLinking: {
      linksTo: [],
      neverTargets: ["informational"],
    },
  },
});

export default directory;
