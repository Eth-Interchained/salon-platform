import { defineApp } from "@interchained/portal-contract";

/**
 * Portal Salon Platform — Portal contract (schema v1)
 *
 * North Star (ecosystem-wide):
 *   NEDB stores knowledge. Portal renders experiences. Links publishes identity.
 *
 * Design principle:
 *   Engine capability equals product feature. AS OF is page history.
 *   VALID AS OF is scheduled publishing. TRACE is content provenance.
 *   Append-only events with NQL aggregation are analytics.
 *
 * This is ONE application serving MANY storefronts: campaign configuration
 * (campaigns/) selects brand, routes, SEO posture, and content strategy per
 * deployment. The campaign definitions specialize this contract — the
 * platform contract states what is true for every storefront.
 */
export default defineApp({
  name: "Portal Salon Platform",
  version: "0.1.0",
  description:
    "One Portal application, many salon storefronts. Campaign-configured SEO platform on NEDB — local appointment generation, national topical authority, and a verifiable salon directory from a single codebase.",
  primaryAudience: [
    "Local clients searching for salon services in Central Florida",
    "People with hair, beauty, and Aveda questions",
    "Independent salon owners who want an ownable, verifiable web presence",
  ],
  goals: [
    "Convert local searchers into booked appointments",
    "Answer every major hair, beauty, and Aveda question genuinely",
    "Give every independent salon a verifiable, claimable profile",
    "Prove the Portal + NEDB + Links stack as a reference application",
  ],

  brand: {
    voice: "warm, expert, verifiable — a stylist who knows, not a brand that shouts",
    colors: ["#0f2f27", "#d8c7a3", "#f8fafc"],
    fonts: ["Inter", "Inter Tight"],
    forbiddenPhrases: [
      "cheap",
      "discount",
      "best-in-class",
      "game-changer",
      "world-class",
      "seamless",
      "synergy",
      "revolutionary",
    ],
  },

  data: {
    campaigns: "./campaigns",
    seeds: "./data/seeds",
    campaignSchema: "./src/lib/campaign.ts",
  },

  policies: {
    publishing: "human_review",
    accessibility: "strict",
    forbiddenClaims: ["medical benefits", "guaranteed results"],
  },

  conversion: {
    primaryGoal: "Book an appointment",
    secondaryGoal: "Claim a salon listing",
    successEvents: [
      "booking_click",
      "call_click",
      "direction_click",
      "claim_start",
      "profile_view",
      "salon_referral_click",
    ],
  },

  seo: {
    enabled: true,
    primaryKeyword: "aveda salon",
    titleTemplate: "%s | Portal Salon Platform",
    defaultDescription:
      "One engine, many storefronts — the campaign-configured salon platform on NEDB, Portal, and NEDB Links.",
    sitemap: true,
    robots: true,
  },
});
