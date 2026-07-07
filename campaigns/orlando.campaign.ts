/**
 * Campaign 1 — aveda-salon-orlando.com
 * Mission: dominate Central Florida local search → appointments.
 *
 * Keyword intent contract (spec §11): this storefront owns LOCAL and
 * TRANSACTIONAL intent. Informational queries belong to national;
 * comparison/discovery belongs to the directory. Never chase either.
 */

import { defineCampaign } from "../src/lib/campaign";

export const orlando = defineCampaign({
  id: "orlando",
  domain: "aveda-salon-orlando.com",
  brandName: "Aveda Salon Orlando",
  mission:
    "Convert Central Florida searchers into booked appointments — city by city, service by service, anchored by Mint on the Avenue on Park Avenue, Winter Park.",
  theme: { id: "orlando" },
  surfaces: ["home", "services", "cities", "stylists", "reviews", "book", "blog"],
  nav: [
    { label: "Services", href: "/services" },
    { label: "Stylists", href: "/stylists" },
    { label: "Reviews", href: "/reviews" },
    { label: "Book", href: "/book" },
  ],
  seo: {
    titleTemplate: "%s | Aveda Salon Orlando",
    defaultDescription:
      "Aveda salon serving Orlando and Central Florida — editorial color, balayage, Botanical Repair, extensions, and master cutting on Park Avenue, Winter Park. Book your appointment.",
    primaryKeywords: [
      "aveda salon orlando",
      "hair color orlando",
      "balayage winter park",
      "botanical repair orlando",
      "hair salon winter park",
    ],
    organization: {
      type: "HairSalon",
      name: "Mint on the Avenue",
      url: "https://aveda-salon-orlando.com",
    },
    sitemapSections: [
      { name: "core", collection: "landing_pages" },
      { name: "articles", collection: "articles" },
    ],
    robots: { allowAll: true, disallow: ["/api", "/admin"] },
  },
  geography: {
    country: "US",
    state: "FL",
    cities: [
      { slug: "orlando", name: "Orlando" },
      { slug: "winter-park", name: "Winter Park" },
      { slug: "maitland", name: "Maitland" },
      { slug: "altamonte-springs", name: "Altamonte Springs" },
      { slug: "college-park", name: "College Park" },
      { slug: "baldwin-park", name: "Baldwin Park" },
      { slug: "oviedo", name: "Oviedo" },
      { slug: "winter-garden", name: "Winter Garden" },
      { slug: "lake-mary", name: "Lake Mary" },
      { slug: "longwood", name: "Longwood" },
      { slug: "sanford", name: "Sanford" },
      { slug: "dr-phillips", name: "Dr. Phillips" },
      { slug: "windermere", name: "Windermere" },
    ],
  },
  conversion: {
    primaryGoal: "Book an appointment",
    successEvents: ["booking_click", "call_click", "direction_click"],
  },
  contentPlan: {
    collections: ["landing_pages", "articles", "faqs", "promotions"],
    internalLinking: {
      linksTo: ["directory"],
      neverTargets: ["informational", "comparison"],
    },
  },
  anchorSalonHandle: "mint-on-the-avenue",
});

export default orlando;
