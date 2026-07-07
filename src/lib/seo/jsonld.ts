/**
 * JSON-LD generators — structured data from REAL entity documents.
 *
 * Honesty rules (spec §8 + §14 risk 7):
 * - No invented fields: absent entity data = absent schema property.
 * - NO aggregateRating from third-party (Google) review counts — Google's
 *   own guidelines disallow self-marking-up third-party ratings. The GBP
 *   4.6/196 renders as attributed TEXT on the page, never as schema.
 * - "By appointment" days are omitted from openingHoursSpecification —
 *   schema has no honest encoding for them; the hours table on the page
 *   carries the note.
 */

interface Nap {
  name?: string;
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  phone?: string;
}

interface HoursRow {
  day?: string;
  open?: string;
  close?: string;
  note?: string;
}

export interface SalonEntityLike {
  nap?: Nap;
  email?: string;
  geo?: { lat?: number; lng?: number };
  hours?: HoursRow[];
  priceRange?: string;
  brands?: string[];
  gbp?: { mapsUrl?: string };
  social?: Record<string, string>;
}

export function hairSalonJsonLd(entity: SalonEntityLike, origin: string): object {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    url: `${origin}/`,
  };
  const nap = entity.nap ?? {};
  if (nap.name) out.name = nap.name;
  if (nap.phone) out.telephone = nap.phone;
  if (entity.email) out.email = entity.email;
  if (nap.street || nap.city) {
    out.address = {
      "@type": "PostalAddress",
      ...(nap.street ? { streetAddress: nap.street } : {}),
      ...(nap.city ? { addressLocality: nap.city } : {}),
      ...(nap.region ? { addressRegion: nap.region } : {}),
      ...(nap.postal ? { postalCode: nap.postal } : {}),
      ...(nap.country ? { addressCountry: nap.country } : {}),
    };
  }
  if (entity.geo?.lat != null && entity.geo?.lng != null) {
    out.geo = {
      "@type": "GeoCoordinates",
      latitude: entity.geo.lat,
      longitude: entity.geo.lng,
    };
  }
  const spec = (entity.hours ?? [])
    .filter((h) => h.day && h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    }));
  if (spec.length > 0) out.openingHoursSpecification = spec;
  if (entity.priceRange) out.priceRange = entity.priceRange;
  if (entity.brands && entity.brands.length > 0) {
    out.brand = entity.brands.map((b) => ({ "@type": "Brand", name: b }));
  }
  const sameAs = [
    ...(entity.gbp?.mapsUrl ? [entity.gbp.mapsUrl] : []),
    ...Object.values(entity.social ?? {}).filter((v) => typeof v === "string" && v.startsWith("http")),
  ];
  if (sameAs.length > 0) out.sameAs = sameAs;
  return out;
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbsJsonLd(crumbs: Crumb[], origin: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${origin}${c.path}`,
    })),
  };
}
