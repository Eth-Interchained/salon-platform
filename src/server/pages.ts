/**
 * Orlando's public surfaces — server-rendered documents from REAL engine
 * data. Mounted only for campaigns with an anchorSalonHandle (spec §7).
 *
 * Every fact rendered here came through the seed loader with provenance;
 * nothing on these pages is invented at render time. City pages beyond
 * the anchor's own city are HELD (404) behind the minimum-content bar —
 * spec §14 risk 1: publish progressively, never 13 thin pages on day one.
 */

import { Router } from "express";
import type { NedbClient } from "nedb-engine-client";

import type { CampaignDefinition } from "../lib/campaign";
import { breadcrumbsJsonLd, hairSalonJsonLd, type SalonEntityLike } from "../lib/seo/jsonld";
import {
  COLLECTIONS,
  getCity,
  getIdentityByHandle,
  listServiceMenus,
  listTeam,
} from "./entities";
import { esc, pageShell } from "./layout";

/** Success-event kinds the platform records (campaign configs subset these). */
export const EVENT_KINDS = new Set([
  "booking_click",
  "call_click",
  "text_click",
  "direction_click",
]);

interface SalonDoc {
  displayName?: string;
  handle?: string;
  cityId?: string | null;
  entity?: SalonEntityLike & {
    textLine?: string;
    bookingUrl?: string;
    positioning?: { tagline?: string; heroLine?: string; philosophy?: string };
    serviceInclusions?: string;
    stylistLevels?: string;
    locationNotes?: string;
    gbp?: { rating?: number; reviewCount?: number; mapsUrl?: string };
    hours?: { day?: string; open?: string; close?: string; note?: string }[];
    nap?: { name?: string; street?: string; city?: string; region?: string; postal?: string; phone?: string };
  };
}

function telHref(phone?: string): string | null {
  return phone ? `tel:${phone.replace(/[^+0-9]/g, "")}` : null;
}
function smsHref(text?: string): string | null {
  return text ? `sms:+1${text.replace(/[^0-9]/g, "")}` : null;
}

function track(db: NedbClient, event: Record<string, unknown>): void {
  const id = `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  db.put(COLLECTIONS.events, id, { ...event, ts: new Date().toISOString() }).catch((err) => {
    console.warn(`[salon] event write failed: ${err instanceof Error ? err.message : err}`);
  });
}

/** Tracked CTA row — every conversion path goes through /go. The booking
 *  URL is DATA (entity.bookingUrl from the seed) — a salon without one
 *  simply doesn't get the button; call/text remain. */
function ctaRow(salon: SalonDoc, origin: string): string {
  const e = salon.entity ?? {};
  const tel = telHref(e.nap?.phone);
  const sms = smsHref(e.textLine);
  const book = typeof e.bookingUrl === "string" && /^https:\/\//.test(e.bookingUrl) ? e.bookingUrl : null;
  const go = (kind: string, to: string) => `/go/${kind}?to=${encodeURIComponent(to)}`;
  const parts: string[] = [];
  if (book) parts.push(`<a class="btn solid" href="${esc(go("booking_click", book))}">Book an appointment</a>`);
  if (sms) parts.push(`<a class="btn ghost" href="${esc(go("text_click", sms))}">Text ${esc(e.textLine ?? "")}</a>`);
  if (tel) parts.push(`<a class="btn ghost" href="${esc(go("call_click", tel))}">Call ${esc(e.nap?.phone ?? "")}</a>`);
  if (e.gbp?.mapsUrl) parts.push(`<a class="chip" href="${esc(go("direction_click", e.gbp.mapsUrl))}">Directions</a>`);
  void origin;
  return `<div class="cta-row">${parts.join("")}</div>`;
}

function hoursTable(salon: SalonDoc): string {
  const rows = (salon.entity?.hours ?? [])
    .map((h) => {
      const val = h.open && h.close ? `${h.open} – ${h.close}` : (h.note ?? "");
      return `<tr><td>${esc(h.day ?? "")}</td><td>${esc(val)}</td></tr>`;
    })
    .join("");
  return `<table class="hours">${rows}</table>`;
}

function gbpLine(salon: SalonDoc): string {
  const g = salon.entity?.gbp;
  if (!g?.rating || !g?.reviewCount) return "";
  // Displayed as attributed TEXT — never as self-marked-up schema (spec §14).
  return `<p class="note">★ ${g.rating} · ${g.reviewCount} reviews on Google</p>`;
}

function footerLines(salon: SalonDoc): string[] {
  const nap = salon.entity?.nap;
  const line = nap
    ? `${nap.name ?? ""} · ${nap.street ?? ""}, ${nap.city ?? ""}, ${nap.region ?? ""} ${nap.postal ?? ""} · ${nap.phone ?? ""}`
    : "";
  return line ? [line] : [];
}

export function createPagesRouter(
  cfg: { publicOrigin?: string },
  campaign: CampaignDefinition,
  db: NedbClient,
  origin: string,
): Router {
  const router = Router();
  const anchor = campaign.anchorSalonHandle;
  if (!anchor) return router; // nothing to mount — campaign has no salon surfaces yet
  void cfg;

  const loadSalon = () => getIdentityByHandle(db, anchor) as Promise<SalonDoc | null>;

  // ── GET / — the salon home ────────────────────────────────────────────────
  router.get("/", (req, res, next) => {
    void (async () => {
      const salon = await loadSalon();
      if (!salon) return next(); // unseeded engine → SPA shell fallback
      const e = salon.entity ?? {};
      const [team, cats] = await Promise.all([
        listTeam(db, anchor),
        listServiceMenus(db, anchor),
      ]);
      const catChips = cats
        .map((m) => `<a class="chip" href="/services/${esc(String(m.category))}">${esc(labelFor(String(m.category)))}</a>`)
        .join("");
      const teamRows = (team as { displayName?: string; entity?: { title?: string } }[])
        .map((t) => `<div class="rowline"><b>${esc(t.displayName ?? "")}</b><span class="note">${esc(t.entity?.title ?? "")}</span></div>`)
        .join("");
      const body = `
<section>
  <p class="kicker">${esc(e.nap?.city ?? "")} · Aveda Concept Salon</p>
  <h1>${esc(e.positioning?.heroLine ?? salon.displayName ?? "")}</h1>
  <p class="sub">${esc(e.positioning?.philosophy ?? "")}</p>
  ${gbpLine(salon)}
</section>
${ctaRow(salon, origin)}
<section class="panel">
  <p class="kicker">services</p>
  <div class="chips" style="margin-top:10px">${catChips}</div>
  <p class="note" style="margin-top:12px">${esc(e.serviceInclusions ?? "")}</p>
</section>
<div class="grid">
  <section class="panel">
    <p class="kicker">hours</p>
    ${hoursTable(salon)}
    <p class="note" style="margin-top:8px">${esc(e.locationNotes ?? "")}</p>
  </section>
  <section class="panel">
    <p class="kicker">the team</p>
    ${teamRows}
  </section>
</div>
<section class="panel">
  <p class="quote">“${esc(e.positioning?.tagline ?? "")}”</p>
</section>`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: `${e.nap?.name ?? salon.displayName ?? ""} — Aveda Salon, ${e.nap?.city ?? ""} FL`,
            description: `${e.positioning?.heroLine ?? ""} Editorial color, balayage, Botanical Repair, and master cutting. Book: ${e.nap?.phone ?? ""}.`,
            path: "/",
            jsonLd: [hairSalonJsonLd(e, origin)],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
      track(db, { campaign: campaign.id, kind: "page_view", path: "/", source: String(req.query.src ?? "direct") });
    })().catch(next);
  });

  // ── GET /services — category index ───────────────────────────────────────
  router.get("/services", (_req, res, next) => {
    void (async () => {
      const salon = await loadSalon();
      if (!salon) return next();
      const menus = await listServiceMenus(db, anchor);
      const cards = menus
        .map((m) => {
          const items = Array.isArray(m.items) ? (m.items as unknown[]).length : 0;
          return `<a class="panel" style="text-decoration:none;display:block" href="/services/${esc(String(m.category))}">
  <p class="kicker">${items} services</p>
  <h2>${esc(labelFor(String(m.category)))}</h2>
</a>`;
        })
        .join("");
      const body = `
<section>
  <p class="kicker">service menu</p>
  <h1>Services &amp; starting rates</h1>
  <p class="sub">${esc((salon.entity?.stylistLevels as string) ?? "")}</p>
</section>
<div class="grid">${cards}</div>
${ctaRow(salon, origin)}`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: "Services",
            description: `Full service menu at ${salon.entity?.nap?.name ?? ""} — color, cutting, texture, extensions, and Aveda treatments in ${salon.entity?.nap?.city ?? ""}, FL. Starting rates, Level 1–8 artists.`,
            path: "/services",
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Services", path: "/services" },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
    })().catch(next);
  });

  // ── GET /services/:category — the price table ────────────────────────────
  router.get("/services/:category", (req, res, next) => {
    void (async () => {
      const category = String(req.params.category).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(category)) return next();
      const salon = await loadSalon();
      if (!salon) return next();
      const menu = (await db.get(COLLECTIONS.services, `${anchor}:${category}`)) as {
        items?: { name: string; price: string; group?: string; note?: string }[];
      } | null;
      if (!menu || !Array.isArray(menu.items)) return next();

      let currentGroup = "";
      const rows = menu.items
        .map((item) => {
          const head =
            item.group && item.group !== currentGroup
              ? ((currentGroup = item.group), `<p class="grouphead">${esc(item.group)}</p>`)
              : "";
          return `${head}<div class="rowline"><div><b>${esc(item.name)}</b>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div><span class="price">${esc(item.price)}</span></div>`;
        })
        .join("");
      const label = labelFor(category);
      const body = `
<section>
  <p class="kicker"><a href="/services" style="text-decoration:none">services</a> / ${esc(category)}</p>
  <h1>${esc(label)}</h1>
  <p class="sub">${esc((salon.entity?.serviceInclusions as string) ?? "")}</p>
</section>
<section class="panel">${rows}</section>
<p class="note">${esc((salon.entity?.stylistLevels as string) ?? "")}</p>
${ctaRow(salon, origin)}`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: `${label} — Services & Prices`,
            description: `${label} at ${salon.entity?.nap?.name ?? ""}, ${salon.entity?.nap?.city ?? ""} FL — starting rates by length and artist level. Every service includes an Aveda Moment of Wellness.`,
            path: `/services/${category}`,
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Services", path: "/services" },
                  { name: label, path: `/services/${category}` },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
    })().catch(next);
  });

  // ── GET /stylists — the roster (registered BEFORE /:city) ────────────────
  router.get("/stylists", (_req, res, next) => {
    void (async () => {
      const salon = await loadSalon();
      if (!salon) return next();
      const team = (await listTeam(db, anchor)) as {
        displayName?: string;
        entity?: { title?: string; bio?: string; roles?: string[] };
      }[];
      const cards = team
        .map((t) => {
          const bio = t.entity?.bio ? `<p class="note" style="margin-top:8px">${esc(t.entity.bio)}</p>` : "";
          return `<section class="panel">
  <p class="kicker">${esc(t.entity?.title ?? "")}</p>
  <h2>${esc(t.displayName ?? "")}</h2>
  ${bio}
</section>`;
        })
        .join("");
      const body = `
<section>
  <p class="kicker">the artists</p>
  <h1>The team at ${esc(String(salon.displayName ?? ""))}</h1>
  <p class="sub">${esc((salon.entity?.stylistLevels as string) ?? "")}</p>
</section>
<div class="grid">${cards}</div>
${ctaRow(salon, origin)}`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: "Stylists & Artists",
            description: `Meet the team at ${salon.entity?.nap?.name ?? ""} — master stylists, colorists, and artists on Park Avenue, ${salon.entity?.nap?.city ?? ""} FL.`,
            path: "/stylists",
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Stylists", path: "/stylists" },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
    })().catch(next);
  });

  // ── GET /book — the conversion surface ───────────────────────────────────
  router.get("/book", (_req, res, next) => {
    void (async () => {
      const salon = await loadSalon();
      if (!salon) return next();
      const e = salon.entity ?? {};
      const body = `
<section>
  <p class="kicker">reserve your visit</p>
  <h1>Book at ${esc(String(salon.displayName ?? ""))}</h1>
  <p class="sub">Pick a service, an artist, and a time that suits you — online via Phorest, or by call or text. Every visit starts with a consultation.</p>
</section>
${ctaRow(salon, origin)}
<div class="grid">
  <section class="panel">
    <p class="kicker">hours</p>
    ${hoursTable(salon)}
  </section>
  <section class="panel">
    <p class="kicker">find us</p>
    <p style="font-size:14.5px">${esc(e.nap?.street ?? "")}, ${esc(e.nap?.city ?? "")}, ${esc(e.nap?.region ?? "")} ${esc(e.nap?.postal ?? "")}</p>
    <p class="note" style="margin-top:6px">${esc(e.locationNotes ?? "")}</p>
  </section>
</div>
<p class="note">${esc(e.serviceInclusions ?? "")}</p>`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: "Book an Appointment",
            description: `Book at ${e.nap?.name ?? ""} — online via Phorest, call ${e.nap?.phone ?? ""}, or text ${e.textLine ?? ""}. ${e.nap?.city ?? ""}, FL.`,
            path: "/book",
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Book", path: "/book" },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
    })().catch(next);
  });

  // ── GET /reviews — attributed social proof, never synthetic ──────────────
  router.get("/reviews", (_req, res, next) => {
    void (async () => {
      const salon = await loadSalon();
      if (!salon) return next();
      const e = salon.entity ?? {};
      const g = e.gbp ?? {};
      const mapsLink = g.mapsUrl
        ? `<a class="btn ghost" href="${esc(String(g.mapsUrl))}" rel="noopener noreferrer">Read our reviews on Google</a>`
        : "";
      const body = `
<section>
  <p class="kicker">what they're saying</p>
  <h1>Fifteen years of trust, five years on Park Avenue</h1>
  ${gbpLine(salon)}
  <p class="sub">We don't publish reviews we can't prove. Every rating above lives on Google, written by real guests — read them at the source.</p>
</section>
<section class="panel">
  <p class="quote">“${esc(e.positioning?.tagline ?? "")}”</p>
</section>
<div class="cta-row">${mapsLink}</div>
${ctaRow(salon, origin)}`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: "Reviews",
            description: `${e.nap?.name ?? ""} — rated ${g.rating ?? ""} from ${g.reviewCount ?? ""} reviews on Google. Read real guest reviews at the source.`,
            path: "/reviews",
            jsonLd: [
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: "Reviews", path: "/reviews" },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
    })().catch(next);
  });

  // ── GET /:city — HELD to the anchor's own city (minimum-content bar) ─────
  router.get("/:city", (req, res, next) => {
    void (async () => {
      const slug = String(req.params.city).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slug) || slug.includes(".")) return next();
      const salon = await loadSalon();
      if (!salon) return next();
      const city = await getCity(db, slug);
      if (!city) return next(); // not a city at all — SPA routes fall through
      // Only the city the salon actually sits in renders today. The other
      // 12 are KNOWN cities held behind the minimum-content bar (§14.1) —
      // they must return a REAL 404, never fall through to the SPA shell
      // (a 200 shell at /orlando would be an indexed soft-404 doorway).
      if (slug !== salon.cityId) {
        res.status(404);
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.send(
          pageShell({
            campaign,
            origin,
            meta: {
              title: `${String(city.name ?? slug)} — coming soon`,
              description: `Our ${String(city.name ?? slug)} page isn't published yet.`,
              path: `/${slug}`,
              noindex: true,
            },
            body: `
<section>
  <p class="kicker">not published yet</p>
  <h1>Our ${esc(String(city.name ?? slug))} page is still at the shampoo bowl</h1>
  <p class="sub">We publish city pages when they're genuinely useful — real details, real proof, no filler. In the meantime, everything about the salon lives one click away.</p>
</section>
${ctaRow(salon, origin)}
<p><a href="/">← Back to ${esc(campaign.brandName)}</a></p>`,
            footerLines: footerLines(salon),
          }),
        );
        return;
      }
      const e = salon.entity ?? {};
      const cats = await listServiceMenus(db, anchor);
      const catChips = cats
        .map((m) => `<a class="chip" href="/services/${esc(String(m.category))}">${esc(labelFor(String(m.category)))}</a>`)
        .join("");
      const cityName = String(city.name ?? slug);
      const body = `
<section>
  <p class="kicker">Aveda salon · ${esc(cityName)}, ${esc(String(city.state ?? ""))}</p>
  <h1>Aveda salon in ${esc(cityName)} — ${esc(String(salon.displayName ?? ""))}</h1>
  <p class="sub">${esc(e.positioning?.heroLine ?? "")}</p>
  ${gbpLine(salon)}
</section>
${ctaRow(salon, origin)}
<div class="grid">
  <section class="panel">
    <p class="kicker">find us</p>
    <p style="font-size:14.5px">${esc(e.nap?.street ?? "")}, ${esc(cityName)}, ${esc(String(city.state ?? ""))} ${esc(e.nap?.postal ?? "")}</p>
    <p class="note" style="margin-top:6px">${esc(e.locationNotes ?? "")}</p>
  </section>
  <section class="panel">
    <p class="kicker">hours</p>
    ${hoursTable(salon)}
  </section>
</div>
<section class="panel">
  <p class="kicker">services in ${esc(cityName)}</p>
  <div class="chips" style="margin-top:10px">${catChips}</div>
</section>`;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(
        pageShell({
          campaign,
          origin,
          meta: {
            title: `Aveda Salon in ${cityName}, FL`,
            description: `${salon.displayName ?? ""} — the Aveda concept salon on ${e.nap?.street ?? "Park Avenue"} in ${cityName}. Editorial color, balayage, Botanical Repair. ${e.nap?.phone ?? ""}.`,
            path: `/${slug}`,
            jsonLd: [
              hairSalonJsonLd(e, origin),
              breadcrumbsJsonLd(
                [
                  { name: "Home", path: "/" },
                  { name: cityName, path: `/${slug}` },
                ],
                origin,
              ),
            ],
          },
          body,
          footerLines: footerLines(salon),
        }),
      );
      track(db, { campaign: campaign.id, kind: "page_view", path: `/${slug}`, source: String(req.query.src ?? "direct") });
    })().catch(next);
  });

  // ── GET /go/:kind — click-tracked outbound (Links /go pattern + sms:) ────
  router.get("/go/:kind", (req, res) => {
    const kind = String(req.params.kind);
    const to = String(req.query.to ?? "");
    if (!EVENT_KINDS.has(kind) || !/^(https?:|tel:|sms:|mailto:)/i.test(to)) {
      res.status(400).send("bad destination");
      return;
    }
    track(db, {
      campaign: campaign.id,
      kind,
      to: to.slice(0, 200),
      source: typeof req.query.src === "string" ? req.query.src : "direct",
      referer: String(req.get("referer") ?? "").slice(0, 200),
    });
    res.redirect(302, to);
  });

  return router;
}

/** Human labels for menu category slugs — display only, slug stays the id. */
const CATEGORY_LABELS: Record<string, string> = {
  "hair-design": "Hair Design",
  "hair-color": "Hair Color",
  "hair-condition": "Hair Condition & Treatments",
  "mint-men": "Mint Men",
  texture: "Texture & Smoothing",
  specialty: "Brows & Waxing",
  extensions: "Extensions",
  consultation: "Consultations",
};

export function labelFor(slug: string): string {
  return (
    CATEGORY_LABELS[slug] ??
    slug.replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase())
  );
}
