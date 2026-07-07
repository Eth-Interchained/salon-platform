/**
 * Public render router — where server-rendered surfaces live.
 *
 * PR-2 skeleton: robots.txt + sitemap.xml, both generated from campaign
 * config. Phase 1 mounts the entity/landing-page surfaces here (spec §7);
 * the pattern is already set — pure builder functions (unit-testable
 * without a server) wrapped by thin Express handlers.
 *
 * Origin discipline: PUBLIC_ORIGIN wins when set; otherwise the campaign's
 * canonical domain. Sitemap URLs and robots Sitemap lines are ALWAYS
 * absolute on the owning campaign's origin — cross-domain duplication
 * cannot be expressed here (spec §8 canonical discipline).
 */

import { Router } from "express";

import type { CampaignDefinition } from "../lib/campaign";
import type { SalonConfig } from "./config";

/** The absolute origin every public URL is built from. */
export function campaignOrigin(cfg: Pick<SalonConfig, "publicOrigin">, campaign: CampaignDefinition): string {
  return (cfg.publicOrigin ?? `https://${campaign.domain}`).replace(/\/+$/, "");
}

/** robots.txt from the campaign's RobotsPolicy. */
export function buildRobots(campaign: CampaignDefinition, origin: string): string {
  const lines: string[] = ["User-agent: *"];
  if (campaign.seo.robots.allowAll) {
    for (const path of campaign.seo.robots.disallow) {
      lines.push(`Disallow: ${path}`);
    }
    if (campaign.seo.robots.disallow.length === 0) {
      lines.push("Allow: /");
    }
  } else {
    // holdback posture: nothing is crawlable, full stop
    lines.push("Disallow: /");
  }
  lines.push("", `Sitemap: ${origin}/sitemap.xml`, "");
  return lines.join("\n");
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * sitemap.xml — PR-2 skeleton emits the homepage only. Honest by design:
 * no invented URLs, no faked lastmod. Phase 1 grows this into per-section
 * NQL queries over published documents (campaign.seo.sitemapSections),
 * with lastmod from engine version timestamps.
 */
export function buildSitemap(_campaign: CampaignDefinition, origin: string): string {
  const urls = [`${origin}/`];
  const body = urls
    .map((u) => `  <url>\n    <loc>${xmlEscape(u)}</loc>\n  </url>`)
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

export function createRenderRouter(cfg: SalonConfig): Router {
  const campaign = cfg.campaign;
  if (!campaign) {
    throw new Error("createRenderRouter: cfg.campaign is null");
  }
  const origin = campaignOrigin(cfg, campaign);
  const router = Router();

  router.get("/robots.txt", (_req, res) => {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.send(buildRobots(campaign, origin));
  });

  router.get("/sitemap.xml", (_req, res) => {
    res.setHeader("content-type", "application/xml; charset=utf-8");
    res.send(buildSitemap(campaign, origin));
  });

  return router;
}
