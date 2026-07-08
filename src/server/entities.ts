/**
 * Entity layer — collections, schemas, and typed reads.
 *
 * Phase 1 stores entities as identity-SHAPED documents (identityType,
 * handle, displayName, entity payload) in the identities collection —
 * the same shape the Links manifest formalizes. Phase 2's registry
 * (defineIdentityType, upstreamed to nedb-links) adds validation and
 * renderer hooks WITHOUT a migration: the documents are already right.
 *
 * Relations are FLAT top-level keys (salonHandle, cityId) queried with
 * NQL WHERE. The engine's typed DAG edges (/link, /neighbors) are the
 * Phase-2+ upgrade — blocked today because nedb-engine-client doesn't
 * wrap them yet (queued upstream; the flagship feeds the library).
 */

import { z } from "zod";
import type { NedbClient } from "nedb-engine-client";

export const COLLECTIONS = {
  identities: "identities",
  handles: "handles",
  cities: "cities",
  services: "services",
  seedRuns: "seed_runs",
  events: "events",
} as const;

// ── Seed-file schemas (data/seeds/*.json — salon.template.json shape) ───────

export const seedTeamMemberSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  roles: z.array(z.string()).default([]),
  owner: z.boolean().default(false),
  isProvider: z.boolean().default(false),
  bio: z.string().optional(),
  instagram: z.string().optional(),
  bookable: z.boolean().optional(),
  level: z.number().nullable().optional(),
});

export const seedServiceItemSchema = z.object({
  name: z.string().min(1),
  price: z.string().min(1),
  group: z.string().optional(),
  note: z.string().optional(),
});

export const seedSalonSchema = z.object({
  identityType: z.literal("salon"),
  handle: z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
  displayName: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  entity: z.record(z.unknown()),
});

/** The generic salon seed contract (salon.template.json). Unknown extra
 *  keys pass through untouched — the seed is data, not our enum. */
export const seedFileSchema = z.object({
  retrievedAt: z.string().min(4),
  sources: z.record(z.unknown()).optional(),
  salon: seedSalonSchema,
  team: z.array(seedTeamMemberSchema).default([]),
  services: z
    .record(
      z.union([
        z.object({
          source: z.string().optional(),
          $note: z.string().optional(),
          items: z.array(seedServiceItemSchema),
        }),
        z.string(), // "$note"-style annotations
      ]),
    )
    .default({}),
  promotions: z.array(z.record(z.unknown())).default([]),
});

export type SeedFile = z.infer<typeof seedFileSchema>;
export type SeedTeamMember = z.infer<typeof seedTeamMemberSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Kebab-case a seed services category key: hairDesign → hair-design. */
export function categorySlug(key: string): string {
  return slugify(key.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));
}

// ── Typed reads (the render plane consumes these in PR-6) ───────────────────

export interface HandleRecord {
  identityId: string;
  status: "active" | "redirect";
  redirectTo?: string;
}

export async function resolveHandle(
  db: NedbClient,
  handle: string,
): Promise<HandleRecord | null> {
  const doc = await db.get(COLLECTIONS.handles, handle);
  return doc ? (doc as unknown as HandleRecord) : null;
}

export async function getIdentityByHandle(
  db: NedbClient,
  handle: string,
): Promise<Record<string, unknown> | null> {
  const rec = await resolveHandle(db, handle);
  if (!rec || rec.status !== "active") return null;
  return db.get(COLLECTIONS.identities, rec.identityId);
}

export async function listTeam(
  db: NedbClient,
  salonHandle: string,
): Promise<Record<string, unknown>[]> {
  return db.query(
    `FROM ${COLLECTIONS.identities} WHERE salonHandle = "${salonHandle}" AND identityType = "stylist" ORDER BY displayName`,
  );
}

export async function listServiceMenus(
  db: NedbClient,
  salonHandle: string,
): Promise<Record<string, unknown>[]> {
  return db.query(
    `FROM ${COLLECTIONS.services} WHERE salonHandle = "${salonHandle}" ORDER BY category`,
  );
}

export async function getCity(
  db: NedbClient,
  slug: string,
): Promise<Record<string, unknown> | null> {
  return db.get(COLLECTIONS.cities, slug);
}

// (WordPress content is NOT copied into per-post documents here — the full
// site snapshot, with every route at its earned path and the complete link
// graph, lives in NEDB via the bridge's own NedbSnapshotStore. See
// src/server/wordpress.ts — the snapshot is the contract.)
