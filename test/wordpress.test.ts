/**
 * WordPress bridge — unit suite for the SNAPSHOT model (the authority
 * bridge, not a content importer): earned paths preserved, canonical
 * posture honored, sitemap honesty, entity-surface precedence by mount
 * order. The live proof runs against a real WordPress + real nedbd.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BridgeRoute } from "@interchained/portal-source-wordpress";

import { buildHead, type PageMeta } from "../src/lib/seo/head";
import { orlando } from "../campaigns/orlando.campaign";
import { loadConfig, validateConfig } from "../src/server/config";
import { journalPosts, wordpressSitemapUrls } from "../src/server/wordpress";

// ── Canonical override (the migration primitive) ────────────────────────────

test("buildHead: canonicalUrl override wins — the source site keeps its earned canonical", () => {
  const meta: PageMeta = {
    title: "Botanical Repair Guide",
    description: "x",
    path: "/botanical-repair-guide/",
    canonicalUrl: "https://mintontheavenue.com/botanical-repair-guide/",
  };
  const head = buildHead(meta, orlando, "https://aveda-salon-orlando.com");
  assert.ok(
    head.includes('<link rel="canonical" href="https://mintontheavenue.com/botanical-repair-guide/">'),
    "canonical must point at the SOURCE, not the serving origin",
  );
  assert.ok(
    head.includes('<meta property="og:url" content="https://mintontheavenue.com/botanical-repair-guide/">'),
    "og:url follows the canonical",
  );
});

test("buildHead: without canonicalUrl the discipline is unchanged — origin + path", () => {
  const meta: PageMeta = { title: "Services", description: "x", path: "/services" };
  const head = buildHead(meta, orlando, "https://aveda-salon-orlando.com");
  assert.ok(head.includes('<link rel="canonical" href="https://aveda-salon-orlando.com/services">'));
});

// ── Config posture ───────────────────────────────────────────────────────────

test("wordpressCanonical: defaults to source, honors self, rejects garbage", () => {
  const base = { SALON_CAMPAIGN: "orlando" } as NodeJS.ProcessEnv;
  assert.equal(loadConfig(base).wordpressCanonical, "source", "source is the default posture");
  assert.equal(
    loadConfig({ ...base, PORTAL_BRIDGE_CANONICAL: "self" }).wordpressCanonical,
    "self",
  );
  const problems = validateConfig(
    loadConfig({ ...base, PORTAL_BRIDGE_CANONICAL: "sideways" }),
    { ...base, PORTAL_BRIDGE_CANONICAL: "sideways" },
  );
  assert.ok(
    problems.some((p) => p.includes("PORTAL_BRIDGE_CANONICAL")),
    "invalid posture must be a boot-blocking problem",
  );
});

// ── Snapshot views ───────────────────────────────────────────────────────────

function fakeRoute(path: string, type: string, published: string): BridgeRoute {
  return {
    id: `wp:${type}:${path}`,
    source: "wordpress",
    type,
    path,
    status: "publish",
    title: path,
    slug: path.replace(/\//g, "") || "home",
    content: { html: "<p>x</p>", text: "x", blocks: [] },
    seo: {
      title: path,
      description: "d",
      canonical: `https://mintontheavenue.com${path}`,
      og: { title: "", description: "", image: "" },
      twitter: { title: "", description: "", image: "" },
      robots: [],
      source: "fallback",
      schemaCandidates: [],
    },
    media: { featuredImage: {}, images: [] },
    taxonomies: [],
    author: {},
    dates: { published, modified: published },
    links: { internal: [], external: [] },
    authority: { preservePath: true, score: 0, notes: [] },
  };
}

/** Minimal stand-in exposing the one method these helpers consume. */
function fakeSource(routes: BridgeRoute[]): { routes(): BridgeRoute[] } {
  return { routes: () => routes };
}

test("journalPosts: only type=post, newest first, EARNED paths intact", () => {
  const source = fakeSource([
    fakeRoute("/about/", "page", "2026-01-01T00:00:00+00:00"),
    fakeRoute("/older-post/", "post", "2026-06-01T00:00:00+00:00"),
    fakeRoute("/newer-post/", "post", "2026-07-01T00:00:00+00:00"),
  ]);
  const posts = journalPosts(source as never);
  assert.deepEqual(
    posts.map((p) => p.path),
    ["/newer-post/", "/older-post/"],
    "pages excluded, posts sorted newest first, paths untouched (no /blog/ prefix invention)",
  );
});

test("sitemap honesty: source posture contributes NOTHING (canonicals point away)", () => {
  const source = fakeSource([fakeRoute("/hello/", "post", "2026-07-01T00:00:00+00:00")]);
  assert.deepEqual(wordpressSitemapUrls(source as never, "https://a.com", "source"), []);
  assert.deepEqual(wordpressSitemapUrls(null, "https://a.com", "self"), []);
});

test("sitemap in self posture: /blog + every route at its earned path", () => {
  const source = fakeSource([
    fakeRoute("/hello/", "post", "2026-07-01T00:00:00+00:00"),
    fakeRoute("/about/", "page", "2026-01-01T00:00:00+00:00"),
  ]);
  const urls = wordpressSitemapUrls(source as never, "https://a.com", "self");
  assert.deepEqual(urls, ["https://a.com/blog", "https://a.com/hello/", "https://a.com/about/"]);
});
