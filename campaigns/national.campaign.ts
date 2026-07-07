/**
 * Campaign 2 — aveda-salon.com
 * Mission: topical authority — answer every major hair, beauty, and
 * Aveda question genuinely, then link DOWN the funnel.
 *
 * Keyword intent contract (spec §11): this storefront owns INFORMATIONAL
 * intent only. No "near me" pages, no city terms — authority flows to the
 * local site and the directory via links, never via competing pages.
 */

import { defineCampaign } from "../src/lib/campaign";

export const national = defineCampaign({
  id: "national",
  domain: "aveda-salon.com",
  brandName: "Aveda Salon",
  mission:
    "Become the place the internet — human and agent alike — goes for honest answers about Aveda, hair color, and healthy hair. Authority earned by answering, cited because provable.",
  theme: { id: "national" },
  surfaces: ["home", "topics", "learn", "guides", "faq", "salons"],
  nav: [
    { label: "Topics", href: "/topics" },
    { label: "Guides", href: "/guides" },
    { label: "FAQ", href: "/faq" },
    { label: "Find a Salon", href: "/salons" },
  ],
  seo: {
    titleTemplate: "%s | Aveda Salon",
    defaultDescription:
      "The educational home for Aveda and healthy hair — what botanical color really is, balayage vs highlights, hair care that works, answered by working salon professionals.",
    primaryKeywords: [
      "what is aveda",
      "balayage vs highlights",
      "botanical repair",
      "healthy hair guide",
      "hair color maintenance",
    ],
    organization: {
      type: "Organization",
      name: "Aveda Salon",
      url: "https://aveda-salon.com",
    },
    sitemapSections: [
      { name: "articles", collection: "articles" },
      { name: "pages", collection: "landing_pages" },
      { name: "faqs", collection: "faqs" },
    ],
    robots: { allowAll: true, disallow: ["/api", "/admin"] },
  },
  conversion: {
    primaryGoal: "Route readers to a participating salon",
    successEvents: ["salon_referral_click", "guide_read", "faq_expand"],
  },
  contentPlan: {
    collections: ["articles", "landing_pages", "faqs"],
    internalLinking: {
      linksTo: ["orlando", "directory"],
      neverTargets: ["local", "transactional", "near-me"],
    },
  },
});

export default national;
