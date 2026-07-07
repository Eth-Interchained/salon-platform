/**
 * App assembly — everything except env loading and listening.
 *
 * Exists as a factory so tests can boot the REAL app against a REAL
 * nedbd on an ephemeral port — and boot it once per campaign in the same
 * process (the three-storefront matrix). The salon platform does not test
 * against mocks; the engine is the system under test as much as the app is.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { NedbClient } from "nedb-engine-client";

import type { SalonConfig } from "./config";
import { createDb } from "./db";
import { createRenderRouter } from "./render";

export interface AppHandle {
  app: Express;
  db: NedbClient;
}

export function createApp(cfg: SalonConfig): AppHandle {
  const campaign = cfg.campaign;
  if (!campaign) {
    throw new Error(
      "createApp: cfg.campaign is null — SALON_CAMPAIGN must be set and valid before the app is constructed",
    );
  }

  const db = createDb(cfg);
  const app = express();

  // ── Request logger ────────────────────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    // req.originalUrl captured now — Express mutates req.url through routers.
    const originalUrl = req.originalUrl || req.url;
    res.on("finish", () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const color =
        status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : status >= 300 ? "\x1b[36m" : "\x1b[32m";
      console.log(
        `${color}${status}\x1b[0m [${campaign.id}] ${req.method} ${originalUrl} — ${ms}ms`,
      );
    });
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: "8mb" }));

  // ── Health — reports every dependency ────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    let nedb: { ok: boolean; version?: string; error?: string } = { ok: false };
    try {
      const h = (await db.health()) as { ok?: boolean; version?: string };
      nedb = { ok: Boolean(h.ok), version: h.version };
    } catch (err) {
      nedb = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    res.json({
      salon: "ok",
      campaign: campaign.id,
      domain: campaign.domain,
      nedb,
      nedbUrl: cfg.nedbUrl,
      db: cfg.nedbDb,
      authConfigured: Boolean(cfg.adminToken),
      aiassist: { configured: Boolean(cfg.aiassistApiKey) },
    });
  });

  // ── Public deployment config — the client's campaign switch ──────────────
  app.get("/api/config", (_req, res) => {
    res.json(publicConfig(cfg));
  });

  // ── Public render router — server-rendered surfaces (spec §7) ────────────
  // Mounted BEFORE static so config-driven robots/sitemap can never be
  // shadowed by a stray file in dist. NOTE: for anchor-salon campaigns the
  // router owns "/" — the SPA shell serves interactive surfaces only.
  app.use(createRenderRouter(cfg, db));

  // ── SPA shell (production build) ──────────────────────────────────────────
  // Runtime campaign injection: ONE build serves every storefront, so the
  // shell learns its identity when served, not when built. The injected
  // blob feeds the pre-paint script and the document title.
  const dist = resolve(process.cwd(), "dist");
  const hasDist = existsSync(join(dist, "index.html"));
  const shellHtml = hasDist
    ? readFileSync(join(dist, "index.html"), "utf8").replace(
        "<head>",
        `<head><script>window.__SALON_CONFIG__=${JSON.stringify(publicConfig(cfg))}</script>`,
      )
    : null;
  const sendShell = (res: Response): void => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(shellHtml);
  };
  if (hasDist) {
    app.get(["/", "/index.html"], (_req, res) => sendShell(res));
    app.use(express.static(dist, { index: false }));
  }

  // ── SPA fallback ──────────────────────────────────────────────────────────
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (hasDist) {
      sendShell(res);
      return;
    }
    res
      .status(503)
      .send(
        `salon-platform [${campaign.id}]: no production build found. Run \`npm run build\`, or use \`npm run dev\`.`,
      );
  });

  return { app, db };
}

/** The block the browser is allowed to know — no tokens, no secrets. */
export function publicConfig(cfg: SalonConfig): Record<string, unknown> {
  const c = cfg.campaign;
  if (!c) throw new Error("publicConfig: campaign is null");
  return {
    campaignId: c.id,
    brandName: c.brandName,
    domain: c.domain,
    mission: c.mission,
    theme: c.theme.id,
    surfaces: c.surfaces,
    nav: c.nav,
    primaryGoal: c.conversion.primaryGoal,
  };
}
