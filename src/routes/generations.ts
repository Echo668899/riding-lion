import { Hono } from "hono";
import {
  getActiveTemplate,
  getJob,
  getLatestTemplateVersion,
  getTemplateVersion,
  getWalletByToken,
  type JobRow,
} from "../lib/db";
import { AppError } from "../lib/errors";
import { markJob } from "../lib/generation";
import { nowSec, randomId } from "../lib/ids";
import { appBaseUrl, signedMediaUrl } from "../lib/media";

type Bindings = { Bindings: Env };

export const generationRoutes = new Hono<Bindings>();

generationRoutes.post("/generations", async (c) => {
  const body = await c.req.json<{
    accessToken?: string;
    assetId?: string;
    idempotencyKey?: string;
    email?: string;
  }>();
  if (!body.accessToken) throw new AppError(400, "missing_token", "accessToken required");
  if (!body.assetId) throw new AppError(400, "missing_asset", "Upload a photo first.");

  const wallet = await getWalletByToken(c.env.DB, body.accessToken);
  if (!wallet) throw new AppError(401, "invalid_token", "Session expired. Upload again.");

  const notifyEmail = (body.email || wallet.email || "").trim().toLowerCase();
  if (notifyEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
      throw new AppError(400, "invalid_email", "Enter a valid email for completion notices.");
    }
    await c.env.DB.prepare(`UPDATE wallets SET email = ?, email_updated_at = ? WHERE id = ?`)
      .bind(notifyEmail, Math.floor(Date.now() / 1000), wallet.id)
      .run();
  } else {
    throw new AppError(400, "missing_email", "Email is required so we can notify you when the clip is ready.");
  }

  const asset = await c.env.DB.prepare(
    `SELECT * FROM assets WHERE id = ? AND access_token = ? AND deleted_at IS NULL`,
  )
    .bind(body.assetId, body.accessToken)
    .first<{ id: string; r2_key: string; kind: string }>();
  if (!asset || asset.kind !== "upload") {
    throw new AppError(404, "asset_not_found", "Upload not found.");
  }

  if (body.idempotencyKey?.startsWith("job_")) {
    const byId = await getJob(c.env.DB, body.idempotencyKey);
    if (byId && byId.access_token === body.accessToken) {
      return c.json(await serializeJob(c.env, c.req.raw, byId));
    }
  }

  {
    const existing = await c.env.DB.prepare(
      `SELECT * FROM generation_jobs
       WHERE access_token = ? AND upload_asset_id = ?
         AND status NOT IN ('failed', 'storage_failed')
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(body.accessToken, body.assetId)
      .first<JobRow>();
    if (existing) {
      return c.json(await serializeJob(c.env, c.req.raw, existing));
    }
  }

  const template = await getActiveTemplate(c.env.DB);
  if (!template) throw new AppError(503, "no_template", "No active template configured.");
  const version = await getLatestTemplateVersion(c.env.DB, template.id);
  if (!version) throw new AppError(503, "no_template_version", "Template version missing.");

  const cost = version.price_credits || 1;
  if (wallet.credits_balance < cost) {
    throw new AppError(402, "insufficient_credits", "Buy credits to generate your clip.");
  }

  const jobId = body.idempotencyKey?.startsWith("job_") ? body.idempotencyKey : randomId("job");
  const t = nowSec();

  // Atomic debit + job create
  const debit = await c.env.DB.prepare(
    `UPDATE wallets SET credits_balance = credits_balance - ? WHERE id = ? AND credits_balance >= ?`,
  )
    .bind(cost, wallet.id, cost)
    .run();
  if (!debit.meta.changes) {
    throw new AppError(402, "insufficient_credits", "Buy credits to generate your clip.");
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO generation_jobs (
        id, wallet_id, access_token, template_id, template_version_id, status, credits_charged,
        upload_asset_id, upload_r2_key, refund_status, notify_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, 'none', ?, ?, ?)`,
    )
      .bind(jobId, wallet.id, wallet.access_token, template.id, version.id, cost, asset.id, asset.r2_key, notifyEmail, t, t)
      .run();
  } catch (err) {
    // Restore credit on insert failure / duplicate
    await c.env.DB.prepare(`UPDATE wallets SET credits_balance = credits_balance + ? WHERE id = ?`)
      .bind(cost, wallet.id)
      .run();
    const existing = await getJob(c.env.DB, jobId);
    if (existing) return c.json(await serializeJob(c.env, c.req.raw, existing));
    throw err;
  }

  const baseUrl = appBaseUrl(c.req.raw, c.env);
  try {
    const instance = await c.env.GENERATION_WORKFLOW.create({
      id: jobId,
      params: { jobId, baseUrl },
    });
    await markJob(c.env.DB, jobId, { workflow_instance_id: instance.id, status: "queued" });
  } catch (err) {
    console.error("workflow create failed, falling back to waitUntil path", err);
    // Fallback for local/dev without workflow engine
    c.executionCtx.waitUntil(runInlineGeneration(c.env, baseUrl, jobId));
  }

  const job = (await getJob(c.env.DB, jobId))!;
  return c.json(await serializeJob(c.env, c.req.raw, job));
});

generationRoutes.get("/generations/:id", async (c) => {
  const token = c.req.query("accessToken");
  if (!token) throw new AppError(401, "missing_token", "accessToken required");
  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job || job.access_token !== token) throw new AppError(404, "not_found", "Order not found");
  return c.json(await serializeJob(c.env, c.req.raw, job));
});

generationRoutes.get("/session/:accessToken", async (c) => {
  const wallet = await getWalletByToken(c.env.DB, c.req.param("accessToken"));
  if (!wallet) throw new AppError(404, "not_found", "Session not found");
  const jobs = await c.env.DB.prepare(
    `SELECT * FROM generation_jobs WHERE access_token = ? ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(wallet.access_token)
    .all<JobRow>();
  return c.json({
    accessToken: wallet.access_token,
    creditsBalance: wallet.credits_balance,
    jobs: await Promise.all((jobs.results ?? []).map((j) => serializeJob(c.env, c.req.raw, j))),
  });
});

generationRoutes.post("/generations/:id/refund", async (c) => {
  const body = await c.req.json<{ accessToken?: string; reason?: string }>();
  if (!body.accessToken) throw new AppError(400, "missing_token", "accessToken required");
  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job || job.access_token !== body.accessToken) {
    throw new AppError(404, "not_found", "Order not found");
  }
  if (!["failed", "storage_failed"].includes(job.status)) {
    throw new AppError(400, "not_refundable", "Only failed deliveries can request a refund.");
  }
  if (job.refund_status === "refunded") {
    const wallet = await getWalletByToken(c.env.DB, body.accessToken);
    return c.json({
      jobId: job.id,
      refundStatus: "refunded",
      creditsBalance: wallet?.credits_balance ?? 0,
    });
  }

  const t = nowSec();
  const existingRefund = await c.env.DB.prepare(`SELECT * FROM refund_requests WHERE job_id = ?`)
    .bind(job.id)
    .first<{ id: string; status: string }>();

  if (existingRefund?.status === "refunded") {
    await c.env.DB.prepare(`UPDATE generation_jobs SET refund_status = 'refunded', updated_at = ? WHERE id = ?`)
      .bind(t, job.id)
      .run();
    const wallet = await getWalletByToken(c.env.DB, body.accessToken);
    return c.json({
      jobId: job.id,
      refundStatus: "refunded",
      creditsBalance: wallet?.credits_balance ?? 0,
      duplicate: true,
    });
  }

  const refundId = existingRefund?.id || randomId("ref");
  if (!existingRefund) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO refund_requests (id, job_id, wallet_id, status, reason, created_at, updated_at)
         VALUES (?, ?, ?, 'refund_requested', ?, ?, ?)`,
      ).bind(refundId, job.id, job.wallet_id, body.reason || null, t, t),
      c.env.DB.prepare(
        `UPDATE generation_jobs SET refund_status = 'refund_requested', updated_at = ? WHERE id = ?`,
      ).bind(t, job.id),
    ]);
  }

  // Mock auto-approve: restore credit once
  const credited = await c.env.DB.prepare(
    `UPDATE generation_jobs SET refund_status = 'refunded', updated_at = ?
     WHERE id = ? AND refund_status != 'refunded'`,
  )
    .bind(t, job.id)
    .run();

  if (credited.meta.changes) {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE wallets SET credits_balance = credits_balance + ? WHERE id = ?`).bind(
        job.credits_charged,
        job.wallet_id,
      ),
      c.env.DB.prepare(`UPDATE refund_requests SET status = 'refunded', updated_at = ? WHERE id = ?`).bind(
        t,
        refundId,
      ),
    ]);
  }

  const wallet = await getWalletByToken(c.env.DB, body.accessToken);
  return c.json({
    jobId: job.id,
    refundStatus: "refunded",
    creditsBalance: wallet?.credits_balance ?? 0,
    notice: "Mock refund approved — credit restored. No real money moved.",
  });
});

generationRoutes.delete("/assets/:id", async (c) => {
  const token = c.req.query("accessToken");
  if (!token) throw new AppError(401, "missing_token", "accessToken required");
  const asset = await c.env.DB.prepare(
    `SELECT * FROM assets WHERE id = ? AND access_token = ? AND deleted_at IS NULL`,
  )
    .bind(c.req.param("id"), token)
    .first<{ id: string; r2_key: string }>();
  if (!asset) throw new AppError(404, "not_found", "Asset not found");
  await c.env.BUCKET.delete(asset.r2_key);
  await c.env.DB.prepare(`UPDATE assets SET deleted_at = ? WHERE id = ?`).bind(nowSec(), asset.id).run();
  return c.json({ ok: true });
});

async function serializeJob(env: Env, request: Request, job: JobRow) {
  const base = appBaseUrl(request, env);
  let outputPlayUrl: string | null = null;
  let outputDownloadUrl: string | null = null;
  if (job.output_r2_key && job.status === "succeeded") {
    outputPlayUrl = await signedMediaUrl(env, base, job.output_r2_key, "inline");
    outputDownloadUrl = await signedMediaUrl(env, base, job.output_r2_key, "attachment");
  }

  let uploadImageUrl: string | null = null;
  if (job.upload_r2_key) {
    uploadImageUrl = await signedMediaUrl(env, base, job.upload_r2_key, "inline").catch(() => null);
  }

  let templateVideoUrl: string | null = null;
  const version = await getTemplateVersion(env.DB, job.template_version_id);
  if (version?.source_video_key) {
    templateVideoUrl = await signedMediaUrl(env, base, version.source_video_key, "inline").catch(() => null);
  }

  return {
    jobId: job.id,
    accessToken: job.access_token,
    status: job.status,
    creditsCharged: job.credits_charged,
    templateVersionId: job.template_version_id,
    uploadAssetId: job.upload_asset_id,
    outputAssetId: job.output_asset_id,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    refundStatus: job.refund_status,
    outputPlayUrl,
    outputDownloadUrl,
    uploadImageUrl,
    templateVideoUrl,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    resultPath: `/r/${job.access_token}?job=${job.id}`,
  };
}

async function runInlineGeneration(env: Env, baseUrl: string, jobId: string) {
  const { completeMockGeneration, submitOrResumeFal, pollFalUntilDone } = await import("../lib/generation");
  const { isMockGeneration } = await import("../lib/fal");
  try {
    await submitOrResumeFal(env, baseUrl, jobId);
    if (isMockGeneration(env)) {
      await new Promise((r) => setTimeout(r, 15000));
      await completeMockGeneration(env, jobId);
      return;
    }
    await pollFalUntilDone(env, jobId, 90);
  } catch (err) {
    console.error("inline generation failed", err);
  }
}
