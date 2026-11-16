# Riding Lion — SEO / GEO keyword & structure map

English-first site. Optimize for the **riding lion AI video** intent first; treat generic “AI photo to video / face swap” as supporting body language only.

## Keyword pillars

| Priority | Intent | Target phrases | Where to place |
|----------|--------|----------------|----------------|
| P0 brand+scene | Transactional | Riding Lion AI video generator, AI lion riding video, make a video of me riding a lion | Title, H1, hero lede |
| P0 proof | Commercial | riding lion AI video example, riding lion AI before and after | `/#examples` |
| P0 trust | Commercial | how much does a riding lion AI video cost, does the riding lion AI video have sound | `/#pricing`, `/#faq` |
| P1 later | Informational | how to make a riding lion AI video / trend | Future `/how-to-make-a-riding-lion-ai-video` |
| Support only | Feature language | AI photo to video, image to video AI, AI face swap video | Body / FAQ differentiation — not title center |

**Do not** claim “silent” as the product promise. Preview is muted; template MP4 includes AAC audio.

**Do not** chase “free AI face swap” as a ranking promise — product is credit-paid (demo checkout until live PSP).

## Site structure

```
/                 indexable — Worker prerender + React hydrate
/privacy          indexable — Worker prerender
/checkout         noindex — simulated pay
/login /account   noindex
/r/:token         noindex — private result
/media/examples/* crawlable public template + cover
/api/*            disallowed in robots.txt
```

Unknown paths return **HTTP 404**. `www` → apex 301. Canonical host: `https://ridinglion.com`.

## On-page layout (home)

1. Nav: brand · Examples · How it works · Pricing · FAQ · **Upload My Photo**
2. Full-bleed hero: H1 “Make a Riding Lion AI Video From Your Photo” + lede + CTA
3. Value ribbon + simulated-checkout notice when applicable
4. `#create` upload / packs (template title from catalog)
5. `#examples` — original template until distinct sample_output exists
6. How it works · Pricing · FAQ (five GEO questions)
7. Footer

## GEO checklist

- [x] Answer-first FAQ (night road, which rider, photo quality, sound, price/failure)
- [x] JSON-LD: Organization, WebSite, SoftwareApplication, HowTo, FAQPage, VideoObject (original template)
- [x] HowTo without unverified `totalTime`
- [x] Offers use `PreOrder` while payments are simulated
- [x] Canonical + Open Graph absolute on prerender
- [x] Private flows `noindex`
- [x] Public `/media/examples/` allowed in robots.txt
- [ ] Distinct verified before/after sample (ordinary portrait → generated result)
- [ ] OG image showing person + lion + night road
- [ ] Submit sitemap in Search Console after production domain
