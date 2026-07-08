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
import type { NedbClient } from "nedb-engine-client";

import type { CampaignDefinition } from "../lib/campaign";
import type { SalonConfig } from "./config";
import { getIdentityByHandle, listArticles, listServiceMenus } from "./entities";
import { createArticlesRouter } from "./articles";
import { createPagesRouter } from "./pages";

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

/** Render a urlset from absolute URLs. Honest by design: no invented
 *  URLs, no faked lastmod (engine-timestamp lastmod arrives when pages
 *  are engine documents with versions worth citing). */
export function buildSitemap(urls: string[]): string {
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

/** The campaign's live public URLs — queried from the ENGINE at request
 *  time, so the sitemap can never advertise a page that wouldn't render.
 *  Mirrors the pages router's own gating exactly (anchor salon present,
 *  city held to the salon's own city). */
export async function sitemapUrls(
  campaign: CampaignDefinition,
  origin: string,
  db: NedbClient,
): Promise<string[]> {
  const urls = [`${origin}/`];

  // Articles are campaign-scoped, not anchor-salon-scoped — a directory or
  // national campaign with no anchor salon at all can still have a journal.
  // Computed before any anchor-salon early return so it's never skipped.
  const articles = await listArticles(db, campaign.id);
  if (articles.length > 0) {
    urls.push(`${origin}/blog`);
    for (const a of articles) urls.push(`${origin}/blog/${a.slug}`);
  }

  const anchor = campaign.anchorSalonHandle;
  if (!anchor) return urls;
  const salon = (await getIdentityByHandle(db, anchor)) as { cityId?: string | null } | null;
  if (!salon) return urls; // unseeded engine → homepage (+ articles) only
  urls.push(`${origin}/services`, `${origin}/stylists`, `${origin}/reviews`, `${origin}/book`);
  const menus = await listServiceMenus(db, anchor);
  for (const m of menus) {
    urls.push(`${origin}/services/${String(m.category)}`);
  }
  if (salon.cityId) urls.push(`${origin}/${salon.cityId}`);
  return urls;
}

export function createRenderRouter(cfg: SalonConfig, db: NedbClient): Router {
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

  router.get("/sitemap.xml", (_req, res, next) => {
    void (async () => {
      const urls = await sitemapUrls(campaign, origin, db);
      res.setHeader("content-type", "application/xml; charset=utf-8");
      res.send(buildSitemap(urls));
    })().catch(next);
  });

  // Journal/blog — WordPress-sourced when synced, otherwise the collection
  // is empty and every route falls through to the SPA shell (next()).
  router.use(createArticlesRouter(campaign, db, origin));

  // Salon surfaces — mounted only when the campaign anchors on a salon.
  router.use(createPagesRouter(cfg, campaign, db, origin));

  return router;
}
