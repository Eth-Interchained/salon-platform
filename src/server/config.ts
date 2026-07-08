/** Server configuration — real env always wins over .env (loaded in server.ts).
 *
 * One codebase, many storefronts, chosen at deploy time: SALON_CAMPAIGN
 * selects the campaign definition; everything else is connection plumbing.
 * Same doctrine as NEDB Links: fail fast and loud at boot rather than
 * letting a misconfigured storefront serve pages.
 */

import type { CampaignDefinition } from "../lib/campaign";
import { resolveCampaign } from "../../campaigns";

export interface SalonConfig {
  /** Express port. SALON_API_PORT is canonical; PORT is the fallback. */
  port: number;
  /** The resolved campaign — null only when SALON_CAMPAIGN is unset
   *  (validateConfig reports it; createApp refuses to run without it). */
  campaign: CampaignDefinition | null;
  /** Public origin for canonical URLs and sitemaps (required in production). */
  publicOrigin?: string;
  /** Running nedbd instance. All state lives there. */
  nedbUrl: string;
  /** ONE database shared by all campaigns (spec §0 decision 3). */
  nedbDb: string;
  /** Bearer token for nedbd, when the daemon is token-gated. */
  nedbToken?: string;
  /** Pre-admin write gate (Links v0.1 pattern). */
  adminToken?: string;
  /** Seed directory for deploy-time salon seeding. */
  seedDir: string;
  /** AiAS gateway for the content pipeline (Phase 3) — optional. */
  aiassistBaseUrl: string;
  aiassistApiKey?: string;
  /** WP Portal Bridge — optional. When both are set, this campaign's /blog
   *  surface is populated by scripts/sync-wordpress.ts and served from a
   *  real WordPress site instead of staying unbuilt. Same env var names as
   *  the bridge plugin's own Connect Portal Frontend screen — copy/paste. */
  wordpressBridgeBaseUrl?: string;
  wordpressBridgeTmk?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SalonConfig {
  const campaignId = env.SALON_CAMPAIGN?.trim();
  // Unknown id throws (fail fast); UNSET resolves to null so importing this
  // module never crashes tooling — validateConfig makes unset fatal at boot.
  const campaign = campaignId ? resolveCampaign(campaignId) : null;
  return {
    port: Number(env.SALON_API_PORT || env.PORT || 3201),
    campaign,
    publicOrigin: env.PUBLIC_ORIGIN || undefined,
    nedbUrl: env.NEDB_URL || "http://127.0.0.1:7070",
    nedbDb: env.NEDB_DB || "salon",
    nedbToken: env.NEDB_TOKEN || undefined,
    adminToken: env.SALON_ADMIN_TOKEN || undefined,
    seedDir: env.SEED_DIR || "./data/seeds",
    aiassistBaseUrl: env.AIASSIST_BASE_URL || "https://api.aiassist.net",
    aiassistApiKey: env.AIASSIST_API_KEY || undefined,
    wordpressBridgeBaseUrl: env.PORTAL_BRIDGE_BASE_URL || undefined,
    wordpressBridgeTmk: env.PORTAL_TMK || undefined,
  };
}

/** Boot-blocking problems. Print them all, then exit — never serve half-configured. */
export function validateConfig(
  c: SalonConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const problems: string[] = [];
  if (!c.campaign) {
    problems.push(
      "SALON_CAMPAIGN is required — this process must know which storefront it is (orlando | national | directory)",
    );
  }
  if (env.NODE_ENV === "production" && !c.publicOrigin) {
    problems.push(
      "PUBLIC_ORIGIN is required in production — canonical URLs, sitemaps, and share links are built from it",
    );
  }
  if (!Number.isFinite(c.port) || c.port <= 0) {
    problems.push(`SALON_API_PORT is not a valid port: ${String(c.port)}`);
  }
  if (Boolean(c.wordpressBridgeBaseUrl) !== Boolean(c.wordpressBridgeTmk)) {
    problems.push(
      "PORTAL_BRIDGE_BASE_URL and PORTAL_TMK must both be set or both be unset — the bridge is half-configured",
    );
  }
  return problems;
}
