/** Shared marketing / SEO copy for Worker prerender + React client. */

export const CANONICAL_ORIGIN = "https://ridinglion.com";

export const SITE = {
  name: "Riding Lion",
  title: "Riding Lion AI Video Generator – Make a Lion Ride From Your Photo",
  description:
    "Preview the night-road lion ride, see which rider your photo replaces, and learn how to create a vertical AI video from one portrait. Credits from $9.99.",
  tagline: "Make a Riding Lion AI video from your photo",
  h1: "Make a Riding Lion AI Video From Your Photo",
  lede:
    "Upload one clear portrait and place yourself on the night-road lion ride — the same camera, motion, and 9:16 frame. No prompts.",
  supportEmail: "support@ridinglion.com",
};

/** Default packs mirrored from D1 seed — prerender uses these; live UI prefers /api/catalog. */
export const DEFAULT_PACKS = [
  { id: "pack_1", credits: 1, priceCents: 999, label: "1 credit", recommended: false },
  { id: "pack_3", credits: 3, priceCents: 1999, label: "3 credits", recommended: true },
  { id: "pack_6", credits: 6, priceCents: 2999, label: "6 credits", recommended: false },
] as const;

export const PUBLIC_EXAMPLE_PATHS = {
  templateVideo: "/media/examples/night-road-lion-ride.mp4",
  cover: "/media/examples/night-road-lion-ride-cover.jpg",
} as const;

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What happens in the Riding Lion AI video?",
    a: "The clip is a vertical night-road scene: a lion approaches, and a rider ends up on the lion’s back. Riding Lion keeps that camera move, timing, and background from the fixed template while swapping the featured rider’s face and hair to match your uploaded portrait.",
  },
  {
    q: "Which rider does my photo replace?",
    a: "One clear solo portrait replaces the featured rider in the template — the person who mounts and rides the lion on the night road. Wardrobe motion, the lion, the road, and the camera path stay from the original plate. Until a verified before/after sample is published, the homepage preview is the original Riding Lion template (not a finished customer render).",
  },
  {
    q: "What kind of photo should I upload?",
    a: "Use a single-person, front-facing portrait with even lighting and a clear face. Avoid sunglasses, heavy blur, group shots, or photos that already show you mid-ride. JPG, PNG, or WebP up to 15MB. Authorized likeness only (18+).",
  },
  {
    q: "How long is the video, and does it include sound?",
    a: "The published template is about 9 seconds at 720×1280 (9:16). Homepage players autoplay muted for browser policy. The original template MP4 includes an AAC soundtrack. Downloaded finishes currently follow the same plate audio behavior; we do not claim a silent export. Check your file after download if you need audio for editing.",
  },
  {
    q: "How much is one video, and what happens if generation fails?",
    a: "One finished Riding Lion short costs 1 credit. Packs are $9.99 (1), $19.99 (3, recommended), and $29.99 (6). Checkout is currently simulated — you will not be charged a real card. If generation fails, request a refund on your result page to restore 1 credit. We email your private result link from support@ridinglion.com when a job succeeds.",
  },
];

export const HOW_STEPS = [
  {
    name: "Preview the night-road lion ride",
    text: "Watch the original Riding Lion template on the homepage (preview plays muted).",
  },
  {
    name: "Upload your portrait",
    text: "Add one authorized, well-lit solo portrait (JPG, PNG, or WebP) of the rider you want to become.",
  },
  {
    name: "Buy credits & generate",
    text: "Pay once for a credit pack (demo checkout today). One credit creates one Riding Lion AI video.",
  },
  {
    name: "Download your short",
    text: "Open your private result link to play, download, or delete the finished clip.",
  },
];

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function packSummary(
  packs: readonly { credits: number; priceCents: number; recommended: boolean }[] = DEFAULT_PACKS,
): string {
  const from = Math.min(...packs.map((p) => p.priceCents));
  const rec = packs.find((p) => p.recommended);
  const recBit = rec ? ` · ${rec.credits} credits ${formatUsd(rec.priceCents)} recommended` : "";
  return `From ${formatUsd(from)}${recBit}`;
}
