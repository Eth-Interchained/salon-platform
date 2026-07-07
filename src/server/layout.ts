/**
 * Server-rendered page shell — Park Avenue Warm, self-contained.
 *
 * Public SEO pages are pure HTML documents: no SPA bundle, no hydration,
 * no Tailwind build — just this shell with the campaign's token values
 * inline. Token values mirror src/index.css's [data-campaign] packs (the
 * blessed 2026-07-07 design direction); if a value changes there, change
 * it here — the packs are the shared source of truth by convention until
 * a build step earns its keep.
 */

import type { CampaignDefinition } from "../lib/campaign";
import { buildHead, type PageMeta } from "../lib/seo/head";

const ORLANDO_CSS = `
  :root{--bg:#f6f2ea;--card:#fffdf8;--ink:#1c2420;--ink-soft:rgba(28,36,32,.66);
    --green:#0f2f27;--sand:#d8c7a3;--sand-deep:#b49a63;--line:rgba(15,47,39,.13)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;
    line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:880px;margin:0 auto;padding:0 6%}
  a{color:var(--green)}
  header.site{display:flex;justify-content:space-between;align-items:center;gap:14px;
    padding:18px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
  .mark{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:20px;
    color:var(--green);text-decoration:none}
  nav.site{display:flex;gap:16px;flex-wrap:wrap}
  nav.site a{font-size:13.5px;font-weight:600;text-decoration:none;color:var(--ink)}
  main{padding:34px 0 46px;display:flex;flex-direction:column;gap:26px}
  .kicker{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--sand-deep)}
  h1{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:clamp(30px,5vw,44px);
    line-height:1.08;color:var(--green);margin-top:6px}
  h2{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:22px;color:var(--green)}
  .sub{color:var(--ink-soft);max-width:560px;font-size:15.5px}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:18px;
    padding:22px;box-shadow:0 1px 2px rgba(15,47,39,.05),0 14px 34px rgba(15,47,39,.08)}
  .cta-row{display:flex;gap:11px;flex-wrap:wrap;align-items:center}
  .btn{font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;
    text-decoration:none;display:inline-block}
  .btn.solid{background:var(--green);color:#e9dfc8}
  .btn.ghost{border:1.5px solid var(--green);color:var(--green)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:13px}
  .rowline{display:flex;justify-content:space-between;gap:16px;align-items:baseline;
    padding:10px 0;border-bottom:1px solid var(--line)}
  .rowline:last-child{border-bottom:none}
  .rowline b{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:16.5px;color:var(--green)}
  .rowline .price{font-family:ui-monospace,monospace;font-size:12.5px;color:var(--sand-deep);white-space:nowrap}
  .rowline small{display:block;font-size:12.5px;color:var(--ink-soft);margin-top:2px}
  .grouphead{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.12em;
    text-transform:uppercase;color:var(--sand-deep);padding:14px 0 4px}
  .chips{display:flex;flex-wrap:wrap;gap:8px}
  .chip{font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:999px;
    background:rgba(15,47,39,.07);color:var(--green);text-decoration:none}
  .hours td{padding:4px 14px 4px 0;font-size:14px}
  .hours td:first-child{color:var(--ink-soft)}
  .note{font-size:12.5px;color:var(--ink-soft)}
  .quote{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:18px;
    line-height:1.45;color:var(--green)}
  footer.site{border-top:1px solid var(--line);padding:26px 0 40px;display:flex;
    justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--ink-soft)}
`;

export interface ShellInput {
  campaign: CampaignDefinition;
  origin: string;
  meta: PageMeta;
  /** <main> inner HTML. */
  body: string;
  /** Footer NAP line (real salon identity) — optional. */
  footerLines?: string[];
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pageShell(input: ShellInput): string {
  const { campaign, origin, meta, body } = input;
  const nav = campaign.nav
    .map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`)
    .join("");
  const footer = (input.footerLines ?? [])
    .map((l) => `<span>${esc(l)}</span>`)
    .join("");
  return `<!doctype html>
<html lang="en" data-campaign="${esc(campaign.id)}">
<head>
  ${buildHead(meta, campaign, origin)}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${ORLANDO_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="site">
      <a class="mark" href="/">${esc(campaign.brandName)}</a>
      <nav class="site">${nav}</nav>
    </header>
    <main>
${body}
    </main>
    <footer class="site">${footer}<span>Powered by Portal · NEDB</span></footer>
  </div>
</body>
</html>`;
}
