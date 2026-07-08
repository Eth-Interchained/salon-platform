/**
 * The blog/article surfaces — WordPress-authored content rendered through
 * the SAME pageShell() and Park Avenue Warm CSS as every other page. No new
 * styling, no new render pipeline: by the time content reaches here it's
 * just another article document, indistinguishable from a hand-seeded one.
 *
 * Populated by scripts/sync-wordpress.ts, not at request time — mounted
 * only when the campaign actually has articles (an empty collection means
 * either nobody's synced yet, or this campaign doesn't use the bridge).
 */

import { Router } from "express";
import type { NedbClient } from "nedb-engine-client";

import type { CampaignDefinition } from "../lib/campaign";
import { breadcrumbsJsonLd } from "../lib/seo/jsonld";
import { getArticleBySlug, listArticles } from "./entities";
import { esc, pageShell } from "./layout";

export function createArticlesRouter(campaign: CampaignDefinition, db: NedbClient, origin: string): Router {
  const router = Router();

  // ── GET /blog — the index ────────────────────────────────────────────────
  router.get("/blog", (_req, res, next) => {
    void (async () => {
      const articles = await listArticles(db, campaign.id);
      if (articles.length === 0) return next(); // nothing synced yet → SPA shell

      const cards = articles
        .map(
          (a) => `<a class="panel" style="text-decoration:none;display:block" href="/blog/${esc(a.slug)}">
  <p class="kicker">${esc(new Date(a.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}</p>
  <h2>${esc(a.title)}</h2>
  <p class="sub" style="margin-top:6px">${esc(a.excerpt)}</p>
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

  // ── GET /blog/:slug — one article ────────────────────────────────────────
  router.get("/blog/:slug", (req, res, next) => {
    void (async () => {
      const slug = String(req.params.slug).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slug)) return next();

      const article = await getArticleBySlug(db, campaign.id, slug);
      if (!article) return next();

      const body = `
<section>
  <p class="kicker">${esc(new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}</p>
  <h1>${esc(article.title)}</h1>
</section>
<section class="panel">${article.html}</section>
<p><a href="/blog">← Back to the journal</a></p>`;

      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: article.seo.title || article.title,
            description: article.seo.description || article.excerpt,
            path: `/blog/${slug}`,
            noindex: article.seo.robots.includes("noindex"),
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Journal", path: "/blog" },
                  { name: article.title, path: `/blog/${slug}` },
                ],
                origin,
              ),
            ],
          },
          body,
        }),
      );
    })().catch(next);
  });

  return router;
}
