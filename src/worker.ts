import { Hono } from "hono";
import { cors } from "hono/cors";
import { jsonError } from "./lib/errors";
import { streamObjectResponse } from "./lib/media";
import { catalogRoutes } from "./routes/catalog";
import { falWebhookRoutes } from "./routes/falWebhook";
import { generationRoutes } from "./routes/generations";
import { paymentRoutes } from "./routes/payments";
import { uploadRoutes } from "./routes/uploads";
import { emailRoutes } from "./routes/email";
import { isMockGeneration } from "./lib/fal";

export { GenerationWorkflow } from "./workflows/generation";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.onError((err, c) => {
  const res = jsonError(err);
  return res;
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    app: c.env.APP_NAME || "Riding Lion",
    mockGeneration: isMockGeneration(c.env),
    falConfigured: Boolean(c.env.FAL_KEY),
  }),
);

app.get("/robots.txt", (c) => {
  const base = (c.env.APP_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  const body = `User-agent: *
Allow: /
Allow: /privacy
Disallow: /checkout
Disallow: /r/
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  return c.text(body, 200, { "content-type": "text/plain; charset=utf-8" });
});

app.get("/sitemap.xml", (c) => {
  const base = (c.env.APP_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/privacy</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>
</urlset>`;
  return c.text(body, 200, { "content-type": "application/xml; charset=utf-8" });
});

app.route("/api", catalogRoutes);
app.route("/api", uploadRoutes);
app.route("/api", emailRoutes);
app.route("/api", paymentRoutes);
app.route("/api", generationRoutes);
app.route("/api", falWebhookRoutes);

app.get("/api/media/:token", async (c) => {
  return streamObjectResponse(c.env, decodeURIComponent(c.req.param("token")));
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
