import { useEffect } from "react";

export const SITE = {
  name: "Riding Lion",
  tagline: "Photo to AI short video — you're the star",
  description:
    "Riding Lion is a photo-to-AI-short-video tool. Upload one authorized portrait, buy credits, and get an 8–10s silent 9:16 face-replacement clip from a fixed template — no prompts. Built for TikTok, Reels, and YouTube Shorts.",
  // Primary / secondary English keywords for copy & meta (not stuffed into one string)
  primaryKeywords: [
    "AI photo to video",
    "AI face swap video",
    "turn photo into video",
    "AI short video from photo",
  ],
  secondaryKeywords: [
    "AI video face replacement",
    "replace face in video AI",
    "image to video AI",
    "AI video face swap online",
    "vertical short video AI",
  ],
};

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is Riding Lion?",
    a: "Riding Lion is an AI photo-to-video tool that places you into a fixed short film template. You upload one clear solo photo of yourself (or someone who authorized you), pay with credits, and get a silent 8–10 second 9:16 clip where your face and hairstyle replace the template performer while motion and camera stay the same.",
  },
  {
    q: "How do I turn a photo into an AI short video?",
    a: "Open Riding Lion, preview the template, upload a well-lit JPG/PNG/WebP portrait, choose a credit pack (3 credits for $19.99 is recommended), complete checkout, and generation starts automatically. One finished clip uses 1 credit. You do not write prompts or pick model settings.",
  },
  {
    q: "Is this the same as a free AI face swap video app?",
    a: "It is related to AI face swap video / face replacement, but Riding Lion is template-first: one curated silent street-turn clip, pay-per-credit delivery, and no free unlimited deepfake playground. Photos and results are private, retained for 7 days by default, and deletable from your result link.",
  },
  {
    q: "What photo works best for AI video face replacement?",
    a: "Use a single-person portrait with even lighting and a clear face. Avoid sunglasses, heavy blur, group shots, or cropped faces. Riding Lion supports JPG, PNG, and WebP up to 15MB.",
  },
  {
    q: "How much does an AI short from a photo cost?",
    a: "Each finished clip costs 1 credit. Credit packs are priced in USD: 1 credit, 3 credits for $19.99 (recommended), and 6 credits for $29.99. Exact pack prices are loaded from the server at checkout.",
  },
  {
    q: "Can I use the clip on TikTok, Instagram Reels, or YouTube Shorts?",
    a: "Yes. Output is a vertical 9:16 short designed for mobile social platforms. Always follow each platform’s rules and only use photos and likenesses you have rights to.",
  },
];

export const HOW_STEPS = [
  {
    name: "Preview the template",
    text: "Watch the fixed silent 9:16 AI short film template on the homepage.",
  },
  {
    name: "Upload your photo",
    text: "Add one authorized, well-lit solo portrait (JPG, PNG, or WebP).",
  },
  {
    name: "Buy credits & generate",
    text: "Pay once for a credit pack. One credit creates one AI photo-to-video clip automatically.",
  },
  {
    name: "Download your short",
    text: "Open your private result link to play, download, or delete the finished clip.",
  },
];

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

    const origin = window.location.origin;
    const path = opts.path ?? window.location.pathname;
    const url = `${origin}${path}`;
    const ogImage = `${origin}/og-image.jpg`;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", `${SITE.name} — Photo to AI short video`);
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

export function homeJsonLd(origin: string, packs: { name: string; price: number }[]) {
  const offers = packs.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: (p.price / 100).toFixed(2),
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `${origin}/`,
  }));

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: origin,
      description: SITE.description,
      logo: `${origin}/icon-512.png`,
      email: "support@ridinglion.com",
      image: `${origin}/og-image.jpg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: origin,
      description: SITE.description,
      potentialAction: {
        "@type": "CreateAction",
        name: "Create AI short video from photo",
        target: `${origin}/`,
      },
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
        "AI photo to video",
        "AI face swap video from template",
        "Silent 9:16 short clips",
        "No prompt writing required",
        "Credit-based pricing",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to turn a photo into an AI short video with Riding Lion",
      description:
        "Create a vertical AI face-replacement short from one portrait using a fixed cinematic template.",
      totalTime: "PT5M",
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
  ];
}
