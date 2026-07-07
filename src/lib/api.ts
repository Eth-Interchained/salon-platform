/**
 * Client-side deployment config.
 *
 * In production the server injects window.__SALON_CONFIG__ into the shell
 * (one build, many storefronts — the shell learns its identity when served).
 * In dev, or if injection is absent, we fetch /api/config through the Vite
 * proxy. Cached module-wide: subsequent mounts are instant.
 */

export interface AppConfig {
  campaignId: string;
  brandName: string;
  domain: string;
  mission: string;
  theme: string;
  surfaces: string[];
  nav: { label: string; href: string }[];
}

declare global {
  interface Window {
    __SALON_CONFIG__?: AppConfig;
  }
}

let cached: AppConfig | null = null;

export async function getAppConfig(): Promise<AppConfig> {
  if (cached) return cached;
  if (typeof window !== "undefined" && window.__SALON_CONFIG__) {
    cached = window.__SALON_CONFIG__;
    return cached;
  }
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error(`config fetch failed: ${r.status}`);
  cached = (await r.json()) as AppConfig;
  return cached;
}
