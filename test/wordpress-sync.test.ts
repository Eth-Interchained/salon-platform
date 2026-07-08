/**
 * WordPress sync — unit suite. Pure pieces only; the live proof (real
 * WordPress → real bridge tunnel → real engine → idempotent re-run) is
 * verified manually against the wp-portal-bridge sandbox, same split as
 * seed.test.ts / api.test.ts.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { articleId } from "../src/server/entities";
import { routeToArticle, wpIdemKey } from "../src/server/wordpress-sync";
import type { BridgeRoute } from "@interchained/portal-source-wordpress";

test("articleId is deterministic and art_-prefixed", () => {
  const a = articleId("orlando", "hello-portal-bridge");
  assert.equal(a, articleId("orlando", "hello-portal-bridge"));
  assert.match(a, /^art_[0-9a-f]{20}$/);
  assert.notEqual(a, articleId("national", "hello-portal-bridge"), "campaign scopes the id");
  assert.notEqual(a, articleId("orlando", "different-slug"), "slug scopes the id");
});

test("wpIdemKey is content-addressed: same contentHash = same key, new content = new key", () => {
  const k1 = wpIdemKey("hash-a", "articles", "art_x");
  assert.equal(k1, wpIdemKey("hash-a", "articles", "art_x"));
  assert.notEqual(k1, wpIdemKey("hash-b", "articles", "art_x"), "changed WordPress content changes the key");
  assert.notEqual(k1, wpIdemKey("hash-a", "seed_runs", "art_x"), "collection scopes the key");
});

function fakeRoute(overrides: Partial<BridgeRoute> = {}): BridgeRoute {
  return {
    id: "wp:post:7",
    source: "wordpress",
    type: "post",
    path: "/hello-portal-bridge/",
    status: "publish",
    title: "Hello Portal Bridge",
    slug: "hello-portal-bridge",
    content: {
      html: '<p>First post. <script>alert(1)</script><a href="/about/">About</a></p>',
      text: "First post.",
      blocks: [],
    },
    seo: {
      title: "Hello Portal Bridge – Bridge Test Site",
      description: "First post through the tunnel.",
      canonical: "http://127.0.0.1:8080/hello-portal-bridge/",
      og: { title: "", description: "", image: "" },
      twitter: { title: "", description: "", image: "" },
      robots: [],
      source: "fallback",
      schemaCandidates: ["BlogPosting", "Article"],
    },
    media: { featuredImage: {}, images: [] },
    taxonomies: [],
    author: {},
    dates: { published: "2026-07-08T00:00:00+00:00", modified: "2026-07-08T15:31:00+00:00" },
    links: { internal: ["/about/"], external: [] },
    authority: { preservePath: true, score: 0, notes: [] },
    ...overrides,
  };
}

test("routeToArticle: only real WordPress fields, nothing invented", () => {
  const article = routeToArticle(fakeRoute(), "orlando");
  assert.equal(article.slug, "hello-portal-bridge");
  assert.equal(article.campaignId, "orlando");
  assert.equal(article.title, "Hello Portal Bridge");
  assert.equal(article.excerpt, "First post through the tunnel.", "excerpt falls back to seo.description");
  assert.equal(article.publishedAt, "2026-07-08T00:00:00+00:00");
  assert.equal(article.modifiedAt, "2026-07-08T15:31:00+00:00");
  assert.equal(article.sourceWpId, "wp:post:7");
  assert.equal(article.seo.canonical, "http://127.0.0.1:8080/hello-portal-bridge/");
});

test("routeToArticle: WordPress HTML is sanitized before it ever reaches the render plane", () => {
  const article = routeToArticle(fakeRoute(), "orlando");
  assert.ok(!article.html.includes("<script"), "script tags must never reach the articles collection");
  assert.ok(!article.html.includes("alert(1)"));
  assert.ok(article.html.includes("<p>First post."), "real content survives sanitization");
  assert.ok(article.html.includes('href="/about/"'), "internal links survive sanitization");
});

test("routeToArticle: robots directives pass through for the render plane to honor", () => {
  const held = routeToArticle(fakeRoute({ seo: { ...fakeRoute().seo, robots: ["noindex"] } }), "orlando");
  assert.deepEqual(held.seo.robots, ["noindex"]);
});
