import { useEffect } from "react";
import {
  CANONICAL_ORIGIN,
  FAQ_ITEMS as FAQ_ITEMS_IMPORT,
  HOW_STEPS as HOW_STEPS_IMPORT,
  PUBLIC_EXAMPLE_PATHS,
  SITE as SHARED_SITE,
  packSummary,
} from "@shared/site-content";

export const FAQ_ITEMS: { q: string; a: string }[] = [...FAQ_ITEMS_IMPORT];
export const HOW_STEPS: { name: string; text: string }[] = [...HOW_STEPS_IMPORT];
export const SITE = {
  name: SHARED_SITE.name,
  tagline: SHARED_SITE.tagline,
  description: SHARED_SITE.description,
  title: SHARED_SITE.title,
  h1: SHARED_SITE.h1,
  lede: SHARED_SITE.lede,
};

type SeoOptions = {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function canonicalOrigin(): string {
  if (typeof window === "undefined") return CANONICAL_ORIGIN;
  const host = window.location.hostname;
  if (host === "ridinglion.com" || host === "www.ridinglion.com") return CANONICAL_ORIGIN;
  return window.location.origin;
}

export function usePageSeo(opts: SeoOptions) {
  useEffect(() => {
    document.title = opts.title;
    upsertMeta("name", "description", opts.description);
    upsertMeta("name", "robots", opts.robots || "index,follow,max-image-preview:large");
    upsertMeta("property", "og:title", opts.title);
    upsertMeta("property", "og:description", opts.description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE.name);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", opts.title);
    upsertMeta("name", "twitter:description", opts.description);

    const origin = canonicalOrigin();
    const path = opts.path ?? window.location.pathname;
    const indexable = path === "/" || path === "/privacy";
    const canonicalHref = indexable
      ? `${CANONICAL_ORIGIN}${path === "/" ? "/" : path}`
      : `${origin}${path}`;
    const ogImage = `${CANONICAL_ORIGIN}/og-image.jpg`;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalHref;
    upsertMeta("property", "og:url", canonicalHref);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", `${SITE.name} — Night-road lion ride AI video`);
    upsertMeta("name", "twitter:image", ogImage);

    const scriptId = "rl-jsonld";
    document.getElementById(scriptId)?.remove();
    if (opts.jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = scriptId;
      script.text = JSON.stringify(opts.jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [opts.title, opts.description, opts.path, opts.robots, JSON.stringify(opts.jsonLd)]);
}

export function homeJsonLd(
  _origin: string,
  packs: { name: string; price: number }[],
  opts?: { mockPayments?: boolean },
) {
  const mockPayments = opts?.mockPayments !== false;
  const offers = packs.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: (p.price / 100).toFixed(2),
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
      email: "support@ridinglion.com",
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
      offers: offers.length ? offers : undefined,
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
        "Original night-road lion ride template. Homepage playback is muted; the MP4 includes an AAC soundtrack.",
      thumbnailUrl: `${CANONICAL_ORIGIN}${PUBLIC_EXAMPLE_PATHS.cover}`,
      contentUrl: `${CANONICAL_ORIGIN}${PUBLIC_EXAMPLE_PATHS.templateVideo}`,
      uploadDate: "2026-11-16",
    },
  ];
}

export { packSummary, PUBLIC_EXAMPLE_PATHS, CANONICAL_ORIGIN };
