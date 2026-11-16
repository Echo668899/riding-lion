import { Hono } from "hono";
import { getActiveTemplate, listCreditPacks } from "../lib/db";
import { isMockGeneration } from "../lib/fal";
import { appBaseUrl, retentionDays, signedMediaUrl } from "../lib/media";
import { PUBLIC_EXAMPLE_PATHS } from "../../shared/site-content";

type Bindings = { Bindings: Env };

export const catalogRoutes = new Hono<Bindings>();

catalogRoutes.get("/catalog", async (c) => {
  const template = await getActiveTemplate(c.env.DB);
  const packs = await listCreditPacks(c.env.DB);
  const base = appBaseUrl(c.req.raw, c.env);

  let templateMedia: {
    sourceVideoUrl: string | null;
    coverUrl: string | null;
    samplePhotoUrl: string | null;
    sampleOutputUrl: string | null;
    sampleKind: "sample_output" | "template_preview";
    publicTemplateVideoUrl: string;
    publicCoverUrl: string;
  } | null = null;

  if (template) {
    const sourceVideoUrl = await signedMediaUrl(c.env, base, template.source_video_key).catch(() => null);
    const coverUrl = template.cover_key
      ? await signedMediaUrl(c.env, base, template.cover_key).catch(() => null)
      : null;
    const samplePhotoUrl = template.sample_photo_key
      ? await signedMediaUrl(c.env, base, template.sample_photo_key).catch(() => null)
      : null;

    let sampleOutputUrl: string | null = null;
    let sampleKind: "sample_output" | "template_preview" = "template_preview";

    if (template.sample_output_key && template.sample_output_key !== template.source_video_key) {
      const [srcHead, sampleHead] = await Promise.all([
        c.env.BUCKET.head(template.source_video_key),
        c.env.BUCKET.head(template.sample_output_key),
      ]);
      const distinct =
        srcHead &&
        sampleHead &&
        !(srcHead.size === sampleHead.size && srcHead.etag === sampleHead.etag);
      if (distinct) {
        sampleOutputUrl = await signedMediaUrl(c.env, base, template.sample_output_key).catch(() => null);
        if (sampleOutputUrl) sampleKind = "sample_output";
      }
    }

    templateMedia = {
      sourceVideoUrl,
      coverUrl,
      samplePhotoUrl,
      sampleOutputUrl,
      sampleKind,
      publicTemplateVideoUrl: `${base}${PUBLIC_EXAMPLE_PATHS.templateVideo}`,
      publicCoverUrl: `${base}${PUBLIC_EXAMPLE_PATHS.cover}`,
    };
  }

  return c.json({
    appName: c.env.APP_NAME || "Riding Lion",
    retentionDays: retentionDays(c.env),
    mockGeneration: isMockGeneration(c.env),
    mockPayments: true,
    template: template
      ? {
          id: template.id,
          slug: template.slug,
          version: template.version,
          title: template.title,
          durationSec: template.duration_sec,
          aspectRatio: template.aspect_ratio,
          resolution: template.resolution,
          priceCredits: template.price_credits,
          media: templateMedia,
        }
      : null,
    creditPacks: packs.map((p) => ({
      id: p.id,
      credits: p.credits,
      priceCents: p.price_cents,
      label: p.label,
      recommended: !!p.recommended,
    })),
  });
});
