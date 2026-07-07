import React from "react";

import { useAppConfig } from "../src/lib/useAppConfig";

export const intent = {
  purpose:
    "Prove one build serves many storefronts — render this deployment's campaign identity from runtime config",
  primaryAction: "Verify the campaign banner matches the domain",
  seoKeyword: "salon",
};

/**
 * PR-1 home: deliberately unstyled beyond basics. The point of this page
 * is the thesis — the SAME build renders a different storefront depending
 * on SALON_CAMPAIGN. PR-2 gives the three shells their distinct feel
 * (campaign theme token packs); Phase 1 replaces this with real surfaces.
 */
export default function HomePage(): React.ReactElement {
  const cfg = useAppConfig();

  if (!cfg) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm opacity-60">loading storefront…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-16 flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <p className="font-display text-xl font-bold">{cfg.brandName}</p>
        <span className="chip">{cfg.campaignId}</span>
      </header>

      <section className="panel p-8 flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-widest opacity-60">
          {cfg.domain}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">{cfg.mission}</h1>
        <p className="text-sm opacity-70">
          One codebase, one build — this storefront was selected by{" "}
          <code className="font-mono">SALON_CAMPAIGN={cfg.campaignId}</code> at process
          start. Surfaces planned here: {cfg.surfaces.join(" · ")}.
        </p>
      </section>

      <nav className="flex gap-4 flex-wrap">
        {cfg.nav.map((n) => (
          <span key={n.href} className="chip" title="mounts in PR-2">
            {n.label}
          </span>
        ))}
      </nav>

      <footer className="mt-auto pt-8 text-xs opacity-50 font-mono">
        Portal Salon Platform · NEDB stores knowledge, Portal renders experiences, Links
        publishes identity
      </footer>
    </main>
  );
}
