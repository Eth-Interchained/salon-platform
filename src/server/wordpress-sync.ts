/**
 * WordPress sync — WP Portal Bridge posts → the articles collection, with
 * provenance. WordPress becomes the editorial engine for the blog/article
 * surface (campaign.contentPlan already names "articles"; this is its first
 * writer). The salon/stylist/service entities seeded by scripts/seed.ts are
 * untouched — this only ever writes to COLLECTIONS.articles.
 *
 * Same discipline as seed.ts: content-addressed idempotency (a run that
 * pulls unchanged WordPress content writes nothing), a provenance root every
 * article's caused_by chains to, verify() at the end. The bridge's own
 * contentHash (from the plugin's dirty-tracking) stands in for seed.ts's
 * file-sha256 — it already IS a canonical hash of "what WordPress currently
 * publishes."
 *
 * Only published, non-password-protected WordPress posts ever reach here —
 * that filtering happens plugin-side (wp-portal-bridge never returns drafts).
 */

import { createHash } from "node:crypto";

import type { NedbClient } from "nedb-engine-client";
import {
  BridgeClient,
  sanitizeWordPressHtml,
  type BridgeRoute,
} from "@interchained/portal-source-wordpress";

import { articleId, COLLECTIONS, type ArticleDoc } from "./entities";

export interface WordPressSyncConfig {
  baseUrl: string;
  tmk: string;
  campaignId: string;
}

export interface WordPressSyncSummary {
  campaignId: string;
  runId: string;
  snapshotId: string;
  /** Published posts in this WordPress snapshot — every one gets a put
   *  attempt, whether or not that attempt turns out to be a no-op. */
  postsFound: number;
  /** REAL writes this run, measured by the engine's own sequence delta —
   *  0 means every attempt collapsed to a content-addressed no-op (an
   *  unchanged WordPress). This is the number that matters; postsFound
   *  attempts something every run regardless of whether anything changed. */
  writesThisRun: number;
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Content-addressed idempotency key — same shape as seed.ts's idemKey(),
 *  keyed on the bridge's contentHash instead of a file's sha256. */
export function wpIdemKey(contentHash: string, coll: string, id: string): string {
  return sha256(`${contentHash}:${coll}:${id}`).slice(0, 24);
}

/** WordPress route → article document. Text-only fields (excerpt) fall back
 *  to the SEO description; only real WordPress fields are ever used — this
 *  never invents content. */
export function routeToArticle(route: BridgeRoute, campaignId: string): ArticleDoc {
  return {
    slug: route.slug,
    campaignId,
    title: route.title,
    excerpt: route.seo.description,
    html: sanitizeWordPressHtml(route.content.html),
    seo: {
      title: route.seo.title,
      description: route.seo.description,
      canonical: route.seo.canonical,
      robots: route.seo.robots,
    },
    publishedAt: route.dates.published,
    modifiedAt: route.dates.modified,
    sourceWpId: route.id,
  };
}

/**
 * Pull every published WordPress post through the signed tunnel and write
 * it into COLLECTIONS.articles. Safe to run repeatedly (cron or manual) —
 * an unchanged WordPress publishes the same contentHash, so every write
 * this function attempts collapses to a content-addressed no-op.
 */
export async function syncWordPressArticles(
  db: NedbClient,
  cfg: WordPressSyncConfig,
): Promise<WordPressSyncSummary> {
  const client = new BridgeClient({ baseUrl: cfg.baseUrl, tmk: cfg.tmk });

  // Handles the plugin's own 413 + chunk-merge transparently.
  const snapshot = await client.getSnapshot();
  const posts = snapshot.routes.filter((route) => route.type === "post");

  const evidence = `wordpress-sync:${cfg.baseUrl}@${snapshot.contentHash.slice(0, 8)}`;
  const runId = `wprun_${snapshot.contentHash.slice(0, 16)}`;

  // Provenance root — every article this run writes chains caused_by to it.
  // Reuses seed_runs (kind discriminates it from a file-based salon seed).
  const run = await db.put(
    COLLECTIONS.seedRuns,
    runId,
    {
      kind: "wordpress-sync",
      sourceUrl: cfg.baseUrl,
      campaignId: cfg.campaignId,
      snapshotId: snapshot.snapshotId,
      contentHash: snapshot.contentHash,
      retrievedAt: snapshot.generatedAt,
    },
    { idem: wpIdemKey(snapshot.contentHash, COLLECTIONS.seedRuns, runId), evidence },
  );
  const rootHash = typeof run.doc._hash === "string" ? [run.doc._hash as string] : [];

  // Measure REAL writes via the engine's own sequence delta — the same
  // technique scripts/seed.ts uses to report idempotency truthfully.
  // Captured after the run-doc put above, so its own no-op/write doesn't
  // pollute this count.
  const before = await db.seq();

  for (const route of posts) {
    const id = articleId(cfg.campaignId, route.slug);
    const doc = routeToArticle(route, cfg.campaignId) as unknown as Record<string, unknown>;
    await db.put(COLLECTIONS.articles, id, doc, {
      causedBy: rootHash,
      idem: wpIdemKey(snapshot.contentHash, COLLECTIONS.articles, id),
      evidence,
    });
  }

  const after = await db.seq();

  return {
    campaignId: cfg.campaignId,
    runId,
    snapshotId: snapshot.snapshotId,
    postsFound: posts.length,
    writesThisRun: after - before,
  };
}
