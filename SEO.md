# Riding Lion — SEO / GEO keyword & structure map

English-first site. Optimize for search + generative answers (Google AI Overviews, Perplexity, ChatGPT browsing) with clear entities, FAQs, and facts — not keyword stuffing.

## Keyword pillars

| Priority | Intent | Target phrases | Where to place |
|----------|--------|----------------|----------------|
| P0 brand | Navigational | Riding Lion | H1, title, Organization schema |
| P0 product | Transactional | AI photo to video, turn photo into video, AI short video from photo | Title/description, H2, HowTo, FAQ |
| P0 product | Transactional | AI face swap video, AI video face replacement, replace face in video AI | FAQ, feature list, SoftwareApplication `featureList` |
| P1 platform | Commercial | TikTok / Reels / YouTube Shorts vertical short | FAQ + body copy once |
| P1 format | Informational | 9:16 silent short, image to video AI | What you get / How it works |
| Avoid as primary | Risky brand | deepfake (mention only to clarify authorized, paid, template-bound use) | FAQ differentiation only |

**Do not** chase “free AI face swap” as a ranking promise — product is credit-paid.

## Site structure

```
/                 indexable — hero + proof + upload/CTA + how-to + pricing facts + FAQ
/privacy          indexable — retention & likeness policy (trust / GEO)
/checkout         noindex — transactional mock pay
/r/:token         noindex — private result credential
/api/*            disallowed in robots.txt
```

Crawlables: `robots.txt`, `sitemap.xml` (absolute locs rewritten at deploy if needed).

## On-page layout (home) — aligned with Tiny Desk pattern

Reference structure from ai-tinydesk.com (not visual clone):

1. Nav: brand · Examples · How it works · Pricing · FAQ · **Create a video** CTA
2. Full-bleed hero: brand H1 + one lede + CTA group over edge-to-edge sample/template film (create form is below the fold)
3. Value ribbon keywords: Your photo + AI face replacement + 8–10s short + One-time credits
4. Create section `#create` (upload, consent, packs, CTA — interaction panel)
5. Examples section (brand-in-H2)
6. How it works (numbered steps / HowTo schema)
7. Pricing detail (packs + Create CTA)
8. FAQ with brand-repeated questions (FAQPage JSON-LD)
9. Footer disclaimer + internal links

## GEO checklist

- [x] Answer-first FAQ (50–150 word factual answers)
- [x] JSON-LD: Organization, WebSite, SoftwareApplication, HowTo, FAQPage
- [x] Canonical + Open Graph on indexable pages
- [x] Private flows `noindex`
- [x] Semantic sections / headings
- [ ] Submit sitemap in Search Console after production domain
- [x] OG image `client/public/og-image.jpg` (1200×630) + favicon set + webmanifest
