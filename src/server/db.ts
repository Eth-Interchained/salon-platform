/**
 * The single NEDB touchpoint. Every byte of state in the salon platform
 * flows through nedb-engine-client to a running nedbd — there is no other
 * database, no local store, no cache of record.
 *
 * NEDB stores knowledge. Portal renders experiences. Links publishes identity.
 * (One shared database for all campaigns — entities are shared, content is
 * campaign-tagged, and DAG edges cannot cross databases. Spec §0 decision 3.)
 */

import { NedbClient } from "nedb-engine-client";
import type { SalonConfig } from "./config";

export function createDb(cfg: Pick<SalonConfig, "nedbUrl" | "nedbDb" | "nedbToken">): NedbClient {
  return new NedbClient({
    url: cfg.nedbUrl,
    db: cfg.nedbDb,
    token: cfg.nedbToken,
    autoCreate: true,
  });
}

/** Provenance helper: the _hash of a document's current version, so the
 *  next put can chain causedBy to it. Returns [] for new documents. */
export function causalParent(doc: Record<string, unknown> | null): string[] {
  const h = doc && typeof doc._hash === "string" ? (doc._hash as string) : null;
  return h ? [h] : [];
}

/** Idempotent database bootstrap — tolerant at boot (nedbd may start after
 *  us in dev), loud in logs. Same defensive pattern as NEDB Links'
 *  ensureDatabase (which also works around the known nedbd body-drain quirk
 *  by touching the database endpoint once before first real use). */
export async function ensureDatabase(db: NedbClient, name: string): Promise<boolean> {
  try {
    await db.createDatabase();
    console.log(`\x1b[36m⬡\x1b[0m database ready: ${name}`);
    return true;
  } catch (err) {
    console.warn(
      `\x1b[33m[salon] could not ensure database "${name}" (${err instanceof Error ? err.message : String(err)}) — is nedbd running?\x1b[0m`,
    );
    return false;
  }
}
