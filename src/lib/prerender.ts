import {
  CANONICAL_ORIGIN,
  DEFAULT_PACKS,
  FAQ_ITEMS,
  HOW_STEPS,
  PUBLIC_EXAMPLE_PATHS,
  SITE,
  formatUsd,
  packSummary,
} from "../../shared/site-content";
import { listCreditPacks } from "./db";
import { isMockGeneration } from "./fal";

type Pack = { credits: number; priceCents: number; label: string; recommended: boolean };

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadPacks(env: Env): Promise<Pack[]> {
  try {
    const rows = await listCreditPacks(env.DB);
    if (rows.length) {
      return rows.map((p) => ({
        credits: p.credits,
        priceCents: p.price_cents,
        label: p.label,
        recommended: !!p.recommended,
      }));
    }
  } catch {
    /* local cold DB */
  }
  return DEFAULT_PACKS.map((p) => ({ ...p }));
}

function jsonLd(packs: Pack[], mockPayments: boolean) {
  const offers = packs.map((p) => ({
    "@type": "Offer",
    name: p.label,
    price: (p.priceCents / 100).toFixed(2),
    priceCurrency: "USD",
    availability: mockPayments
      ? "https://schema.org/PreOrder"
      : "https://schema.org/InStock",
    url: `${CANONICAL_ORIGIN}/`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: CANONICAL_ORIGIN,
      description: SITE.description,
      logo: `${CANONICAL_ORIGIN}/icon-512.png`,
      email: SITE.supportEmail,
      image: `${CANONICAL_ORIGIN}/og-image.jpg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: CANONICAL_ORIGIN,
      description: SITE.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: SITE.description,
      offers,
      featureList: [
        "Riding Lion AI video from one photo",
        "Night-road lion ride template",
        "9:16 vertical short",
        "No prompt writing required",
        "Credit-based pricing",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to make a Riding Lion AI video from your photo",
      description:
        "Upload one portrait and generate a night-road lion ride AI short from the fixed Riding Lion template.",
      step: HOW_STEPS.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "Original Riding Lion Template — Night Road Lion Ride",
      description:
        "Original night-road lion ride template previewed on Riding Lion. Homepage playback is muted; the MP4 includes an AAC soundtrack.",
      thumbnailUrl: `${CANONICAL_ORIGIN}${PUBLIC_EXAMPLE_PATHS.cover}`,
      contentUrl: `${CANONICAL_ORIGIN}${PUBLIC_EXAMPLE_PATHS.templateVideo}`,
      uploadDate: "2026-11-16",
      isFamilyFriendly: true,
    },
  ];
}

function headShell(opts: {
  title: string;
  description: string;
  path: string;
  jsonLd?: unknown;
  assetHtml: string;
}): string {
  const url = `${CANONICAL_ORIGIN}${opts.path}`;
  const og = `${CANONICAL_ORIGIN}/og-image.jpg`;
  const ld = opts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="theme-color" content="#0b1210" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE.name)}" />
  <meta property="og:title" content="${escapeHtml(opts.title)}" />
  <meta property="og:description" content="${escapeHtml(opts.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${og}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(opts.title)}" />
  <meta name="twitter:description" content="${escapeHtml(opts.description)}" />
  <meta name="twitter:image" content="${og}" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  ${opts.assetHtml}
  ${ld}
</head>`;
}

/** Pull stylesheet + module script tags from the Vite-built index.html. */
export async function extractAssetTags(env: Env): Promise<string> {
  try {
    const res = await env.ASSETS.fetch(new Request("https://assets.local/index.html"));
    if (!res.ok) return "";
    const html = await res.text();
    // IMPORTANT: include full <script ...></script> pairs. Injecting only the
    // opening tag leaves </script> missing and browsers treat following HTML
    // (including CSS <link>) as script source — styles appear “lost”.
    const links = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((t) => /rel=["']stylesheet["']/i.test(t) && /\/assets\//i.test(t));
    const scripts = [
      ...html.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi),
    ].map((m) => m[0]);
    return [...links, ...scripts].join("\n  ");
  } catch {
    return "";
  }
}

export async function renderHomeHtml(env: Env): Promise<string> {
  const packs = await loadPacks(env);
  const mockPayments = true;
  const mockGen = isMockGeneration(env);
  const assetHtml = await extractAssetTags(env);
  const priceLine = packSummary(packs);
  const packList = packs
    .map(
      (p) =>
        `<li><strong>${escapeHtml(p.label)}</strong> — ${formatUsd(p.priceCents)}${
          p.recommended ? " (recommended)" : ""
        }</li>`,
    )
    .join("");
  const faqHtml = FAQ_ITEMS.map(
    (item) =>
      `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`,
  ).join("");
  const steps = HOW_STEPS.map(
    (s, i) =>
      `<li><strong>${String(i + 1).padStart(2, "0")} ${escapeHtml(s.name)}</strong> — ${escapeHtml(s.text)}</li>`,
  ).join("");

  const body = `
<nav aria-label="Primary">
  <a href="/">${escapeHtml(SITE.name)}</a>
  <a href="/#examples">Examples</a>
  <a href="/#how-it-works">How it works</a>
  <a href="/#pricing">Pricing</a>
  <a href="/#faq">FAQ</a>
  <a href="/privacy">Privacy</a>
  <a href="/#create">Upload My Photo</a>
</nav>
<main>
  <header>
    <h1>${escapeHtml(SITE.h1)}</h1>
    <p>${escapeHtml(SITE.lede)}</p>
    <p><a href="/#create">Upload My Photo</a> · <a href="/#examples">See the original template</a></p>
    <p>${escapeHtml(priceLine)}. Checkout is currently simulated — you will not be charged.</p>
  </header>

  <section id="examples">
    <h2>See the Original Lion Ride and the Generated Result</h2>
    <p>The clip below is the <strong>original Riding Lion template</strong> (night-road lion ride). A verified before/after with an ordinary portrait will replace this when a distinct sample output is published. Homepage playback is muted; the file includes a soundtrack.</p>
    <video src="${PUBLIC_EXAMPLE_PATHS.templateVideo}" poster="${PUBLIC_EXAMPLE_PATHS.cover}" controls playsinline muted loop width="360" title="Original Riding Lion Template"></video>
    <p><a href="${PUBLIC_EXAMPLE_PATHS.templateVideo}">Download original template MP4</a></p>
  </section>

  <section id="create">
    <h2>Upload My Photo</h2>
    <p>Template: <strong>Night Road Lion Ride</strong> · ~9s · 9:16 · preview muted · 1 credit. Open the interactive uploader in your browser to continue.</p>
    ${mockGen ? "<p>Generation may run in demo mode on this environment.</p>" : ""}
  </section>

  <section id="how-it-works">
    <h2>How to make a Riding Lion AI video</h2>
    <ol>${steps}</ol>
  </section>

  <section id="pricing">
    <h2>How much does a Riding Lion AI video cost?</h2>
    <p>1 credit = 1 finished video. ${escapeHtml(priceLine)}. Simulated payment only for now.</p>
    <ul>${packList}</ul>
  </section>

  <section id="faq">
    <h2>Riding Lion FAQ</h2>
    ${faqHtml}
  </section>
</main>
<footer>
  <p>${escapeHtml(SITE.name)} · Support: <a href="mailto:${SITE.supportEmail}">${SITE.supportEmail}</a></p>
  <p><a href="/privacy">Privacy &amp; likeness</a></p>
</footer>`;

  return `${headShell({
    title: SITE.title,
    description: SITE.description,
    path: "/",
    jsonLd: jsonLd(packs, mockPayments),
    assetHtml,
  })}
<body>
  <div id="root">${body}</div>
</body>
</html>`;
}

export async function renderPrivacyHtml(env: Env): Promise<string> {
  const assetHtml = await extractAssetTags(env);
  const title = `Privacy & likeness — ${SITE.name}`;
  const description =
    "How Riding Lion handles uploaded photos, AI video outputs, 7-day retention, deletion, email notices, and authorized likeness use.";
  const body = `
<nav><a href="/">${escapeHtml(SITE.name)}</a> · <a href="/privacy">Privacy</a></nav>
<article>
  <h1>Privacy &amp; likeness</h1>
  <p>Riding Lion is an AI photo-to-video service at ridinglion.com. Upload only portraits of yourself or people who authorized this use.</p>
  <p><strong>Retention.</strong> Uploaded photos and finished clips are private by default and kept about <strong>7 days</strong> unless you delete them sooner from your result page.</p>
  <p><strong>Email.</strong> Result links are sent from ${SITE.supportEmail}.</p>
  <p><a href="/">← Back to Riding Lion</a></p>
</article>`;

  return `${headShell({ title, description, path: "/privacy", assetHtml })}
<body>
  <div id="root">${body}</div>
</body>
</html>`;
}

export function renderNotFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page not found — ${SITE.name}</title>
  <meta name="robots" content="noindex" />
  <link rel="canonical" href="${CANONICAL_ORIGIN}/404" />
</head>
<body>
  <main>
    <h1>Page not found</h1>
    <p>That URL is not part of Riding Lion.</p>
    <p><a href="/">Go to the homepage</a></p>
  </main>
</body>
</html>`;
}
