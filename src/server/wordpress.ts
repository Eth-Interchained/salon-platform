/**
 * WordPress bridge — the SNAPSHOT is the contract (spec: "an authority
 * bridge, not just a content bridge").
 *
 * The full site snapshot — every published route at its EARNED path, the
 * internal link graph, menus, assets, one contentHash — is consumed via
 * WordPressBridgeSource and persisted in NEDB through the bridge's own
 * NedbSnapshotStore (hash-chained, caused_by provenance, verify-able).
 * No per-post copying, no invented URLs: a WordPress post living at
 * /botanical-repair-guide/ renders at /botanical-repair-guide/ on this
 * storefront, in this storefront's theme, and every internal link in the
 * content resolves because every published route resolves.
 *
 * Precedence (decision 2026-07-08): entity surfaces win — this router
 * mounts AFTER pages.ts, so /services, /stylists, /book, cities, and the
 * salon home always belong to the platform; WordPress fills everything
 * else at WordPress's paths.
 *
 * Canonical posture (decision 2026-07-08, built for migration scenarios):
 *   source (default) — routes carry the ORIGIN WordPress site's earned
 *     canonical. The new domain serves the content; the source keeps the
 *     authority. WordPress routes stay OUT of this domain's sitemap (a
 *     sitemap must list canonical URLs, and these canonicals point away).
 *   self — the migration has landed: canonicals are origin + path here,
 *     and WordPress routes join the sitemap.
 */

import { Router } from "express";
import {
  sanitizeWordPressHtml,
  wordpressPortalBridge,
  type BridgeRoute,
  type WordPressBridgeSource,
} from "@interchained/portal-source-wordpress";

import type { CampaignDefinition } from "../lib/campaign";
import { breadcrumbsJsonLd } from "../lib/seo/jsonld";
import type { SalonConfig } from "./config";
import { esc, pageShell } from "./layout";

export type CanonicalPosture = "source" | "self";

/** Build the bridge source from config — null when the bridge isn't
 *  configured. Snapshots persist to the SAME nedbd the platform already
 *  runs on (the bridge's NedbSnapshotStore, its own collection). */
export function createWordPressSource(cfg: SalonConfig): WordPressBridgeSource | null {
  if (!cfg.wordpressBridgeBaseUrl || !cfg.wordpressBridgeTmk) return null;
  return wordpressPortalBridge({
    baseUrl: cfg.wordpressBridgeBaseUrl,
    tmk: cfg.wordpressBridgeTmk,
    nedbUrl: cfg.nedbUrl,
    nedbToken: cfg.nedbToken,
    log: (message) => console.log(`\x1b[36m[wp-bridge]\x1b[0m ${message}`),
  });
}

/** Boot-resilient readiness: WordPress down + a last-good snapshot in NEDB
 *  boots fine (that's the point of snapshot-first); WordPress down + NO
 *  stored snapshot must not kill the storefront — entity surfaces keep
 *  serving and the bridge retries lazily with a cooldown. */
export function createLazyReady(
  source: WordPressBridgeSource,
  cooldownMs = 30_000,
): () => Promise<boolean> {
  let ready = false;
  let lastAttempt = 0;
  return async () => {
    if (ready) return true;
    const now = Date.now();
    if (now - lastAttempt < cooldownMs) return false;
    lastAttempt = now;
    try {
      await source.ready();
      ready = true;
    } catch (err) {
      console.warn(
        `\x1b[33m[wp-bridge] not ready (${err instanceof Error ? err.message : String(err)}) — ` +
          `entity surfaces unaffected; retrying in ${cooldownMs / 1000}s\x1b[0m`,
      );
    }
    return ready;
  };
}

/** WordPress "post" routes from the snapshot, newest first — the journal index. */
export function journalPosts(source: WordPressBridgeSource): BridgeRoute[] {
  return source
    .routes()
    .filter((r) => r.type === "post")
    .sort((a, b) => (b.dates.published || "").localeCompare(a.dates.published || ""));
}

function renderRoute(
  route: BridgeRoute,
  campaign: CampaignDefinition,
  origin: string,
  posture: CanonicalPosture,
): string {
  const published = route.dates.published
    ? new Date(route.dates.published).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const body = `
<section>
  ${published ? `<p class="kicker">${esc(published)}</p>` : ""}
  <h1>${esc(route.title)}</h1>
</section>
<section class="panel">${sanitizeWordPressHtml(route.content.html)}</section>
<p><a href="/blog">← The journal</a> · <a href="/">${esc(campaign.brandName)}</a></p>`;

  return pageShell({
    campaign,
    origin,
    meta: {
      title: route.title,
      description: route.seo.description,
      path: route.path,
      // Migration posture: the source site's EARNED canonical (authority
      // stays home) — or self once the migration lands.
      canonicalUrl: posture === "source" && route.seo.canonical ? route.seo.canonical : undefined,
      noindex: route.seo.robots.includes("noindex"),
      jsonLd: [
        breadcrumbsJsonLd(
          [
            { name: "Home", path: "/" },
            { name: route.title, path: route.path },
          ],
          origin,
        ),
      ],
    },
    body,
  });
}

export function createWordPressRouter(
  campaign: CampaignDefinition,
  source: WordPressBridgeSource,
  origin: string,
  posture: CanonicalPosture,
): Router {
  const router = Router();
  const ensureReady = createLazyReady(source);

  // ── GET /blog — journal index over snapshot posts, REAL paths only ───────
  router.get("/blog", (_req, res, next) => {
    void (async () => {
      if (!(await ensureReady())) return next();
      const posts = journalPosts(source);
      if (posts.length === 0) return next();

      const cards = posts
        .map(
          (p) => `<a class="panel" style="text-decoration:none;display:block" href="${esc(p.path)}">
  <p class="kicker">${esc(
    p.dates.published
      ? new Date(p.dates.published).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "",
  )}</p>
  <h2>${esc(p.title)}</h2>
  <p class="sub" style="margin-top:6px">${esc(p.seo.description)}</p>
</a>`,
        )
        .join("");

      const body = `
<section>
  <p class="kicker">from the chair</p>
  <h1>Journal</h1>
  <p class="sub">Color, care, and craft — notes from ${esc(campaign.brandName)}.</p>
</section>
<div class="grid">${cards}</div>`;

      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: "Journal",
            description: `Hair care, color, and Aveda notes from ${campaign.brandName}.`,
            path: "/blog",
            jsonLd: [breadcrumbsJsonLd([{ name: "Home", path: "/" }, { name: "Journal", path: "/blog" }], origin)],
          },
          body,
        }),
      );
    })().catch(next);
  });

  // ── Everything else: resolve against the snapshot at the EXACT path ──────
  // Mounted after the entity surfaces, so this only ever sees paths the
  // platform itself didn't claim. Misses fall through to the SPA shell.
  router.get("*", (req, res, next) => {
    void (async () => {
      const path = req.path;
      // Static/asset/api traffic is never WordPress's.
      if (path.startsWith("/api/") || path.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(path)) {
        return next();
      }
      if (!(await ensureReady())) return next();

      const route = await source.resolve(path);
      if (!route) return next();

      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("x-salon-source", "wordpress-portal-bridge");
      res.send(renderRoute(route, campaign, origin, posture));
    })().catch(next);
  });

  return router;
}

/** Sitemap contribution — only in self posture (a sitemap must list
 *  canonical URLs; in source posture these canonicals point away). */
export function wordpressSitemapUrls(
  source: WordPressBridgeSource | null,
  origin: string,
  posture: CanonicalPosture,
): string[] {
  if (!source || posture !== "self") return [];
  const urls: string[] = [];
  const routes = source.routes();
  if (routes.some((r) => r.type === "post")) urls.push(`${origin}/blog`);
  for (const route of routes) {
    urls.push(`${origin}${route.path}`);
  }
  return urls;
}
