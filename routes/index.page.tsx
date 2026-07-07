import React from "react";

import { useAppConfig } from "../src/lib/useAppConfig";

export const intent = {
  purpose:
    "Prove one build serves many storefronts — the SAME DOM renders three distinct products via campaign theme tokens",
  primaryAction: "Verify the storefront feels like its campaign",
  seoKeyword: "salon",
};

/**
 * Campaign-themed home. The DOM below is IDENTICAL for every campaign —
 * Fraunces-on-cream warmth, Newsreader-on-paper authority, and Inter-Tight-
 * on-slate utility all come from the token packs in src/index.css, selected
 * by the data-campaign attribute the pre-paint script sets on <html>.
 *
 * Doctrine: if this file ever needs `if (campaign === …)` to feel right,
 * the theme system has failed — fix the tokens, not the JSX.
 */
export default function HomePage(): React.ReactElement {
  const cfg = useAppConfig();

  if (!cfg) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="kicker">loading storefront…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-14 flex flex-col gap-10">
      <header className="flex items-center justify-between gap-4">
        <p className="font-display text-2xl font-bold tracking-tight">{cfg.brandName}</p>
        <span className="chip">{cfg.campaignId}</span>
      </header>

      <section className="panel p-8 sm:p-10 flex flex-col gap-5">
        <p className="kicker">{cfg.domain}</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] tracking-tight">
          {cfg.mission}
        </h1>
        <p className="muted text-[15px] max-w-xl">
          One codebase, one build. This storefront was selected by{" "}
          <code style={{ fontFamily: "var(--font-data)" }}>
            SALON_CAMPAIGN={cfg.campaignId}
          </code>{" "}
          at process start — same DOM as its two siblings, different physics.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a className="btn-primary" href={cfg.nav[0]?.href ?? "/"}>
            {cfg.primaryGoal}
          </a>
          <span className="kicker">surfaces: {cfg.surfaces.join(" · ")}</span>
        </div>
      </section>

      <nav className="flex gap-3 flex-wrap" aria-label="Planned sections">
        {cfg.nav.map((n) => (
          <span key={n.href} className="chip-ghost" title="mounts with its phase">
            {n.label}
          </span>
        ))}
      </nav>

      <footer className="mt-auto pt-8 kicker">
        Portal Salon Platform · NEDB stores knowledge, Portal renders experiences, Links
        publishes identity
      </footer>
    </main>
  );
}
