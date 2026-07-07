/**
 * Seed loader — data/seeds/*.json → NEDB, with provenance.
 *
 * Every run writes (or no-ops onto) a seed_runs document whose id is
 * content-addressed from the file bytes; every document written by that
 * run chains caused_by to it. TRACE on any entity reconstructs which
 * file, which content hash, which run put it there. Idempotency is
 * content-addressed too: re-running an unchanged seed writes NOTHING
 * (asserted by sequence number in the live suite); editing the file
 * yields new idem keys and the changed docs update.
 *
 * Real data only: the loader validates shape, never invents fields.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { NedbClient } from "nedb-engine-client";

import type { CampaignDefinition } from "../lib/campaign";
import {
  categorySlug,
  COLLECTIONS,
  seedFileSchema,
  slugify,
  type SeedFile,
  type SeedTeamMember,
} from "./entities";

export interface SeedSummary {
  file: string;
  runId: string;
  salonHandle: string;
  identities: number;
  serviceMenus: number;
  cities: number;
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Deterministic, immutable identity id from the (globally unique) handle. */
export function identityId(handle: string): string {
  return `idn_${sha256(handle).slice(0, 20)}`;
}

/** Content-addressed idempotency key: same file content + same doc = no-op. */
export function idemKey(fileHash: string, coll: string, id: string): string {
  return sha256(`${fileHash}:${coll}:${id}`).slice(0, 24);
}

export function listSeedFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.includes("template"))
    .sort()
    .map((f) => join(dir, f));
}

export function parseSeedFile(path: string): { seed: SeedFile; raw: string } {
  const raw = readFileSync(path, "utf8");
  const seed = seedFileSchema.parse(JSON.parse(raw));
  return { seed, raw };
}

function teamIdentityDoc(
  member: SeedTeamMember,
  salonHandle: string,
): { handle: string; doc: Record<string, unknown> } {
  const handle = slugify(member.name);
  return {
    handle,
    doc: {
      identityType: "stylist",
      handle,
      displayName: member.name,
      status: "draft",
      salonHandle,
      entity: {
        title: member.title,
        roles: member.roles,
        owner: member.owner,
        isProvider: member.isProvider,
        ...(member.bio ? { bio: member.bio } : {}),
        ...(member.level != null ? { level: member.level } : {}),
      },
    },
  };
}

async function seedOneFile(
  db: NedbClient,
  path: string,
): Promise<SeedSummary> {
  const file = path.split("/").pop() ?? path;
  const { seed, raw } = parseSeedFile(path);
  const fileHash = sha256(raw);
  const runId = `run_${fileHash.slice(0, 16)}`;
  const evidence = `seed:${file}@${fileHash.slice(0, 8)}`;

  // 1. Provenance root — everything this run writes chains to it.
  const run = await db.put(
    COLLECTIONS.seedRuns,
    runId,
    { file, sha256: fileHash, retrievedAt: seed.retrievedAt, kind: "salon-seed" },
    { idem: idemKey(fileHash, COLLECTIONS.seedRuns, runId), evidence },
  );
  const rootHash = typeof run.doc._hash === "string" ? [run.doc._hash as string] : [];
  const opts = (coll: string, id: string) => ({
    causedBy: rootHash,
    idem: idemKey(fileHash, coll, id),
    evidence,
  });

  let identities = 0;

  // 2. The salon identity + its handle.
  const salonId = identityId(seed.salon.handle);
  await db.put(
    COLLECTIONS.identities,
    salonId,
    {
      identityType: seed.salon.identityType,
      handle: seed.salon.handle,
      displayName: seed.salon.displayName,
      status: seed.salon.status,
      cityId:
        typeof (seed.salon.entity as { cityId?: unknown }).cityId === "string"
          ? ((seed.salon.entity as { cityId: string }).cityId)
          : null,
      entity: seed.salon.entity,
    },
    opts(COLLECTIONS.identities, salonId),
  );
  identities += 1;
  await db.put(
    COLLECTIONS.handles,
    seed.salon.handle,
    { identityId: salonId, status: "active" },
    opts(COLLECTIONS.handles, seed.salon.handle),
  );

  // 3. Team → stylist identities + handles. Duplicate handles are a seed
  //    bug — fail loud, never silently overwrite.
  const seen = new Set<string>([seed.salon.handle]);
  for (const member of seed.team) {
    const { handle, doc } = teamIdentityDoc(member, seed.salon.handle);
    if (seen.has(handle)) {
      throw new Error(`${file}: duplicate handle "${handle}" — add a disambiguator to the name`);
    }
    seen.add(handle);
    const id = identityId(handle);
    await db.put(COLLECTIONS.identities, id, doc, opts(COLLECTIONS.identities, id));
    await db.put(
      COLLECTIONS.handles,
      handle,
      { identityId: id, status: "active" },
      opts(COLLECTIONS.handles, handle),
    );
    identities += 1;
  }

  // 4. Service menus — one doc per category, render-ready price tables.
  let serviceMenus = 0;
  for (const [key, value] of Object.entries(seed.services)) {
    if (typeof value === "string" || key.startsWith("$")) continue;
    const slug = categorySlug(key);
    const docId = `${seed.salon.handle}:${slug}`;
    await db.put(
      COLLECTIONS.services,
      docId,
      {
        category: slug,
        categoryLabel: key,
        salonHandle: seed.salon.handle,
        source: value.source ?? null,
        items: value.items,
      },
      opts(COLLECTIONS.services, docId),
    );
    serviceMenus += 1;
  }

  return { file, runId, salonHandle: seed.salon.handle, identities, serviceMenus, cities: 0 };
}

/** Cities come from campaign geography (config, not salon files) — deduped
 *  across campaigns, tagged with every campaign that claims them. */
async function seedCities(
  db: NedbClient,
  campaigns: CampaignDefinition[],
): Promise<number> {
  const bySlug = new Map<string, { slug: string; name: string; state: string; country: string; campaigns: string[] }>();
  for (const c of campaigns) {
    if (!c.geography) continue;
    for (const city of c.geography.cities) {
      const existing = bySlug.get(city.slug);
      if (existing) {
        if (!existing.campaigns.includes(c.id)) existing.campaigns.push(c.id);
      } else {
        bySlug.set(city.slug, {
          slug: city.slug,
          name: city.name,
          state: c.geography.state,
          country: c.geography.country,
          campaigns: [c.id],
        });
      }
    }
  }
  const cities = [...bySlug.values()];
  const listHash = sha256(JSON.stringify(cities));
  for (const city of cities) {
    await db.put(COLLECTIONS.cities, city.slug, city, {
      idem: idemKey(listHash, COLLECTIONS.cities, city.slug),
      evidence: `campaign-geography@${listHash.slice(0, 8)}`,
    });
  }
  return cities.length;
}

export interface SeedAllResult {
  summaries: SeedSummary[];
  cities: number;
  indexes: string[];
}

export async function seedAll(
  db: NedbClient,
  campaigns: CampaignDefinition[],
  seedDir: string,
): Promise<SeedAllResult> {
  const dir = resolve(process.cwd(), seedDir);
  const summaries: SeedSummary[] = [];
  for (const path of listSeedFiles(dir)) {
    summaries.push(await seedOneFile(db, path));
  }
  const cities = await seedCities(db, campaigns);

  // Indexes for the render plane's WHERE/ORDER BY paths. Idempotent.
  const indexes = ["identities.identityType", "identities.salonHandle", "services.salonHandle"];
  await db.createIndex(COLLECTIONS.identities, "identityType", "eq");
  await db.createIndex(COLLECTIONS.identities, "salonHandle", "eq");
  await db.createIndex(COLLECTIONS.services, "salonHandle", "eq");

  return { summaries, cities, indexes };
}
