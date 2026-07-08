/**
 * Head builder — every server-rendered page's <head> from one function.
 *
 * Canonical discipline is structural (spec §8): the canonical URL is
 * built from the owning campaign's origin. ONE deliberate exception
 * (decision 2026-07-08): WordPress-bridge routes in migration posture
 * carry the SOURCE site's earned canonical via canonicalUrl — the new
 * domain serves the content, the origin WordPress keeps the authority,
 * until the migration flips the posture to self-canonical. Nothing else
 * may set canonicalUrl; campaign pages remain origin + path, period.
 */

import type { CampaignDefinition } from "../campaign";

export interface PageMeta {
  /** Page title — slotted into the campaign's titleTemplate (%s). */
  title: string;
  description: string;
  /** Absolute path starting with "/" — canonical = origin + path. */
  path: string;
  /** ABSOLUTE canonical override — WordPress-bridge migration posture
   *  only (canonical-to-source). Leave unset everywhere else. */
  canonicalUrl?: string;
  /** JSON-LD objects, rendered as script tags in order. */
  jsonLd?: object[];
  /** Explicit robots directive (e.g. held pages). Absent = indexable. */
  noindex?: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pageTitle(meta: PageMeta, campaign: CampaignDefinition): string {
  return campaign.seo.titleTemplate.replace("%s", meta.title);
}

/** Inner-<head> HTML: title, meta, canonical, OG, JSON-LD scripts. */
export function buildHead(
  meta: PageMeta,
  campaign: CampaignDefinition,
  origin: string,
): string {
  const title = pageTitle(meta, campaign);
  const canonical = meta.canonicalUrl ?? `${origin}${meta.path}`;
  const parts: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
  ];
  if (meta.noindex) {
    parts.push(`<meta name="robots" content="noindex, follow">`);
  }
  parts.push(
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(campaign.brandName)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta name="twitter:card" content="summary">`,
  );
  for (const obj of meta.jsonLd ?? []) {
    // </script> can never appear inside — escape closing tags defensively.
    const json = JSON.stringify(obj).replace(/<\/script/gi, "<\\/script");
    parts.push(`<script type="application/ld+json">${json}</script>`);
  }
  return parts.join("\n  ");
}
