/**
 * The campaign abstraction — the ENTIRE behavioral difference between
 * the storefronts lives in these definitions.
 *
 * One engine. Multiple experiences. Everything configurable.
 *
 * Doctrine: no `if (campaign === "orlando")` scattered through business
 * logic. Behavior differences live in the definition or they don't ship.
 * Everything downstream — route mounting, head builders, sitemaps, nav,
 * JSON-LD organization — takes the campaign object as an argument.
 */

import { z } from "zod";

/** Public route families a campaign can mount (spec §7). PR-1 mounts only
 *  the SPA shell; the render router (PR-2) mounts these as they ship. */
export const SURFACES = [
  "home",
  "services",
  "cities",
  "stylists",
  "reviews",
  "book",
  "blog",
  "topics",
  "learn",
  "guides",
  "faq",
  "salons",
  "directory",
  "search",
] as const;
export type SurfaceId = (typeof SURFACES)[number];

export interface NavItem {
  label: string;
  href: string;
}

/** Campaign theme selector. PR-1 carries the id; the token packs
 *  (palette, radius, shadows, fonts) land with the render plane in PR-2. */
export interface CampaignTheme {
  id: string;
}

export interface RobotsPolicy {
  /** false = staging/holdback posture (Disallow: /). */
  allowAll: boolean;
  /** Path prefixes to disallow even when open (e.g. /api, /admin). */
  disallow: string[];
}

/** Declarative sitemap section — each becomes an NQL query in PR-2+ (spec §8). */
export interface SitemapSection {
  name: string;
  collection: string;
  /** Optional NQL WHERE fragment beyond campaign + published-status scoping. */
  where?: string;
}

/** JSON-LD Organization identity for this domain (spec §8). */
export interface OrgJsonLd {
  type: "HairSalon" | "Organization" | "WebSite";
  name: string;
  url: string;
  sameAs?: string[];
}

export interface CampaignSeo {
  /** e.g. "%s | Aveda Salon Orlando" — %s is the page title. */
  titleTemplate: string;
  defaultDescription: string;
  primaryKeywords: string[];
  organization: OrgJsonLd;
  sitemapSections: SitemapSection[];
  robots: RobotsPolicy;
}

export interface CityRef {
  /** Slug into the cities collection (and the URL segment). */
  slug: string;
  /** Display name — never derived from the slug (Dr. Phillips ≠ Dr-phillips). */
  name: string;
}

export interface CampaignGeography {
  country: string;
  state: string;
  cities: CityRef[];
}

export interface CampaignConversion {
  primaryGoal: string;
  /** Event kinds that count as success (append-only events collection). */
  successEvents: string[];
}

/** The anti-cannibalization contract, declared per campaign (spec §11). */
export interface LinkingPolicy {
  /** Campaign ids this campaign links DOWN to (funnel direction). */
  linksTo: string[];
  /** Query intents this campaign must never target (audit-checked). */
  neverTargets: string[];
}

export interface ContentPlan {
  /** Content collections this campaign publishes from. */
  collections: string[];
  internalLinking: LinkingPolicy;
}

export interface CampaignDefinition {
  id: string;
  /** Canonical host — anchors every canonical URL, sitemap, and feed. */
  domain: string;
  /** Wordmark: nav, titles, footers. One-line change per deployment. */
  brandName: string;
  mission: string;
  theme: CampaignTheme;
  surfaces: SurfaceId[];
  nav: NavItem[];
  seo: CampaignSeo;
  geography?: CampaignGeography;
  conversion: CampaignConversion;
  contentPlan: ContentPlan;
  /** The salon identity this storefront centers on (seeded by handle). */
  anchorSalonHandle?: string;
}

// ── Runtime validation — a bad campaign file fails at boot, not at render ──

const surfaceSchema = z.enum(SURFACES);

export const campaignSchema: z.ZodType<CampaignDefinition> = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "campaign id: lowercase slug"),
  domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "domain: bare host, no scheme"),
  brandName: z.string().min(1).max(60),
  mission: z.string().min(1),
  theme: z.object({ id: z.string().min(1) }),
  surfaces: z.array(surfaceSchema).min(1),
  nav: z.array(z.object({ label: z.string().min(1), href: z.string().startsWith("/") })),
  seo: z.object({
    titleTemplate: z.string().includes("%s", { message: "titleTemplate needs %s" }),
    defaultDescription: z.string().min(20).max(320),
    primaryKeywords: z.array(z.string().min(1)).min(1),
    organization: z.object({
      type: z.enum(["HairSalon", "Organization", "WebSite"]),
      name: z.string().min(1),
      url: z.string().url(),
      sameAs: z.array(z.string().url()).optional(),
    }),
    sitemapSections: z.array(
      z.object({
        name: z.string().min(1),
        collection: z.string().min(1),
        where: z.string().optional(),
      }),
    ),
    robots: z.object({
      allowAll: z.boolean(),
      disallow: z.array(z.string().startsWith("/")),
    }),
  }),
  geography: z
    .object({
      country: z.string().length(2),
      state: z.string().min(2),
      cities: z
        .array(
          z.object({
            slug: z.string().regex(/^[a-z0-9-]+$/),
            name: z.string().min(1),
          }),
        )
        .min(1),
    })
    .optional(),
  conversion: z.object({
    primaryGoal: z.string().min(1),
    successEvents: z.array(z.string().min(1)).min(1),
  }),
  contentPlan: z.object({
    collections: z.array(z.string().min(1)),
    internalLinking: z.object({
      linksTo: z.array(z.string()),
      neverTargets: z.array(z.string()),
    }),
  }),
  anchorSalonHandle: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

/** Validate at definition time — a broken campaign file can't even import. */
export function defineCampaign(def: CampaignDefinition): CampaignDefinition {
  return campaignSchema.parse(def);
}
