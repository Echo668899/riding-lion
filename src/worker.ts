import { Hono } from "hono";
import { cors } from "hono/cors";
import { jsonError } from "./lib/errors";
import { streamObjectResponse } from "./lib/media";
import {
  extractAssetTags,
  renderHomeHtml,
  renderNotFoundHtml,
  renderPrivacyHtml,
} from "./lib/prerender";
import { catalogRoutes } from "./routes/catalog";
import { falWebhookRoutes } from "./routes/falWebhook";
import { generationRoutes } from "./routes/generations";
import { paymentRoutes } from "./routes/payments";
import { uploadRoutes } from "./routes/uploads";
import { emailRoutes } from "./routes/email";
import { isMockGeneration } from "./lib/fal";
import { CANONICAL_ORIGIN } from "../shared/site-content";

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
  const body = `User-agent: *
Allow: /
Allow: /privacy
Allow: /media/examples/
Disallow: /checkout
Disallow: /login
Disallow: /account
Disallow: /r/
Disallow: /api/

Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;
  return c.text(body, 200, { "content-type": "text/plain; charset=utf-8" });
});

app.get("/sitemap.xml", (c) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${CANONICAL_ORIGIN}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${CANONICAL_ORIGIN}/privacy</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>
</urlset>`;
  return c.text(body, 200, { "content-type": "application/xml; charset=utf-8" });
});

/** Crawlable public examples (not under /api/). */
const PUBLIC_EXAMPLE_KEYS: Record<string, { key: string; contentType: string }> = {
  "night-road-lion-ride.mp4": {
    key: "templates/turn-smile/v1/source.mp4",
    contentType: "video/mp4",
  },
  "night-road-lion-ride-cover.jpg": {
    key: "templates/turn-smile/v1/cover.jpg",
    contentType: "image/jpeg",
  },
};

app.get("/media/examples/:file", async (c) => {
  const file = c.req.param("file");
  const mapped = PUBLIC_EXAMPLE_KEYS[file];
  if (!mapped) {
    return c.json({ error: { code: "not_found", message: "Example media not found." } }, 404);
  }
  const obj = await c.env.BUCKET.get(mapped.key);
  if (!obj) {
    return c.json({ error: { code: "not_found", message: "Example media missing in storage." } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("content-type", mapped.contentType);
  headers.set("cache-control", "public, max-age=86400, immutable");
  headers.set("content-disposition", `inline; filename="${file}"`);
  return new Response(obj.body, { headers });
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

const SPA_EXACT = new Set(["/checkout", "/login", "/account"]);
const SPA_PREFIXES = ["/r/"];

function isSpaPath(pathname: string): boolean {
  if (SPA_EXACT.has(pathname)) return true;
  return SPA_PREFIXES.some((p) => pathname.startsWith(p));
}

function looksLikeStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/assets/")) return true;
  return /\.[a-zA-Z0-9]{1,8}$/.test(pathname);
}

async function serveSpaShell(env: Env): Promise<Response> {
  const assetHtml = await extractAssetTags(env);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="${CANONICAL_ORIGIN}/" />
  <title>Riding Lion</title>
  ${assetHtml}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname.startsWith("www.")) {
      const next = new URL(request.url);
      next.hostname = url.hostname.replace(/^www\./, "");
      next.protocol = "https:";
      return Response.redirect(next.toString(), 301);
    }

    // API + public media + robots/sitemap via Hono
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/media/") ||
      url.pathname === "/robots.txt" ||
      url.pathname === "/sitemap.xml"
    ) {
      return app.fetch(request, env, ctx);
    }

    if (url.pathname === "/" || url.pathname === "") {
      const html = await renderHomeHtml(env);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
      });
    }

    if (url.pathname === "/privacy") {
      const html = await renderPrivacyHtml(env);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }

    if (looksLikeStaticAsset(url.pathname)) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
      return new Response(renderNotFoundHtml(), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (isSpaPath(url.pathname)) {
      return serveSpaShell(env);
    }

    return new Response(renderNotFoundHtml(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
