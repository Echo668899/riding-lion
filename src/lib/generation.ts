import { getJob, getTemplateVersion, type JobRow } from "./db";
import {
  falGetResult,
  falGetStatus,
  falSubmitEditing,
  falUploadR2Object,
  isMockGeneration,
  mapFalUserError,
} from "./fal";
import { nowSec, randomId } from "./ids";
import { putUpload } from "./media";

export function buildPrompt(template: { prompt_template: string; target_description: string }): string {
  return template.prompt_template.replaceAll("{target_description}", template.target_description);
}

export async function markJob(
  db: D1Database,
  jobId: string,
  fields: Partial<JobRow> & { status?: string },
): Promise<void> {
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [nowSec()];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "id") continue;
    sets.push(`${k} = ?`);
    values.push(v);
  }
  values.push(jobId);
  await db.prepare(`UPDATE generation_jobs SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function saveOutputFromUrl(
  env: Env,
  job: JobRow,
  videoUrl: string,
): Promise<{ assetId: string; key: string }> {
  const res = await fetch(videoUrl);
  if (!res.ok || !res.body) {
    throw Object.assign(new Error("Failed to download generated video from fal."), {
      code: "output_download_failed",
    });
  }
  try {
    const saved = await putUpload(env, {
      walletId: job.wallet_id,
      accessToken: job.access_token,
      kind: "output",
      contentType: res.headers.get("content-type") || "video/mp4",
      body: res.body,
      keyPrefix: `outputs/${job.wallet_id}`,
    });
    await markJob(env.DB, job.id, {
      status: "succeeded",
      output_asset_id: saved.id,
      output_r2_key: saved.key,
      error_code: null,
      error_message: null,
    });
    const { notifyJobReady } = await import("./email");
    await notifyJobReady(env, job.id);
    return { assetId: saved.id, key: saved.key };
  } catch (err) {
    await markJob(env.DB, job.id, {
      status: "storage_failed",
      error_code: "storage_failed",
      error_message:
        err instanceof Error
          ? err.message
          : "Generated video could not be saved. Please request a refund.",
    });
    throw err;
  }
}

export async function submitOrResumeFal(
  env: Env,
  baseUrl: string,
  jobId: string,
): Promise<JobRow> {
  let job = await getJob(env.DB, jobId);
  if (!job) throw new Error("job not found");

  // Idempotent: never double-submit if we already have a request_id
  if (job.fal_request_id && job.fal_status_url) {
    return job;
  }

  const version = await getTemplateVersion(env.DB, job.template_version_id);
  if (!version || !job.upload_r2_key) {
    await markJob(env.DB, jobId, {
      status: "failed",
      error_code: "missing_inputs",
      error_message: "Template or upload missing for this order.",
    });
    throw new Error("missing inputs");
  }

  if (isMockGeneration(env)) {
    await markJob(env.DB, jobId, { status: "processing" });
    // Mock path: copy template (or upload placeholder) as output after short wait in workflow
    return (await getJob(env.DB, jobId))!;
  }

  await markJob(env.DB, jobId, { status: "submitting" });

  const prompt = buildPrompt(version);
  // Only attach webhook when base URL is publicly reachable (not loopback)
  const webhookUrl = isPublicBaseUrl(baseUrl) ? `${baseUrl}/api/webhooks/fal` : undefined;

  try {
    const [videoUrl, imageUrl] = await Promise.all([
      falUploadR2Object(env, version.source_video_key, "template.mp4"),
      falUploadR2Object(env, job.upload_r2_key, "portrait.jpg"),
    ]);
    const submitted = await falSubmitEditing(env, {
      prompt,
      videoUrl,
      imageUrl,
      webhookUrl,
      endUserId: job.wallet_id,
    });
    await markJob(env.DB, jobId, {
      status: "submitted",
      fal_request_id: submitted.request_id,
      fal_status_url: submitted.status_url,
      fal_response_url: submitted.response_url,
    });
  } catch (err) {
    // On timeout/unknown: re-check DB in case a parallel path wrote request_id
    job = (await getJob(env.DB, jobId))!;
    if (job.fal_request_id) return job;

    const code = (err as { code?: string }).code || "fal_submit_failed";
    const message =
      err instanceof Error
        ? err.message
        : mapFalUserError(500, err).message;
    await markJob(env.DB, jobId, {
      status: "failed",
      error_code: code,
      error_message: message,
    });
    throw err;
  }

  return (await getJob(env.DB, jobId))!;
}

export async function pollFalUntilDone(
  env: Env,
  jobId: string,
  maxPolls = 60,
): Promise<JobRow> {
  let job = (await getJob(env.DB, jobId))!;
  if (!job.fal_status_url || !job.fal_response_url) {
    throw new Error("missing fal urls");
  }
  const statusUrl = job.fal_status_url;
  const responseUrl = job.fal_response_url;

  for (let i = 0; i < maxPolls; i++) {
    const status = await falGetStatus(env, statusUrl);
    if (status.status === "COMPLETED") {
      try {
        const result = await falGetResult(env, responseUrl);
        if (!result.video?.url) {
          await markJob(env.DB, jobId, {
            status: "failed",
            error_code: "fal_empty_result",
            error_message: "Generation finished but no video was returned.",
          });
          return (await getJob(env.DB, jobId))!;
        }
        await saveOutputFromUrl(env, job, result.video.url);
      } catch (err) {
        const code = (err as { code?: string }).code || "fal_result_failed";
        if (code !== "storage_failed") {
          await markJob(env.DB, jobId, {
            status: "failed",
            error_code: code,
            error_message: err instanceof Error ? err.message : "Generation failed.",
          });
        }
      }
      return (await getJob(env.DB, jobId))!;
    }
    if (status.error || status.error_type) {
      const mapped = mapFalUserError(422, status);
      await markJob(env.DB, jobId, {
        status: "failed",
        error_code: mapped.code,
        error_message: status.error || mapped.message,
      });
      return (await getJob(env.DB, jobId))!;
    }
    await markJob(env.DB, jobId, { status: "processing" });
    await sleep(5000);
    job = (await getJob(env.DB, jobId))!;
    if (job.status === "succeeded" || job.status === "failed" || job.status === "storage_failed") {
      return job;
    }
  }
  return (await getJob(env.DB, jobId))!;
}

export async function completeMockGeneration(env: Env, jobId: string): Promise<void> {
  const job = await getJob(env.DB, jobId);
  if (!job) return;
  if (job.status === "succeeded") return;
  const version = await getTemplateVersion(env.DB, job.template_version_id);
  const sourceKey = version?.sample_output_key || version?.source_video_key;
  if (!sourceKey) {
    await markJob(env.DB, jobId, {
      status: "failed",
      error_code: "mock_missing_template",
      error_message: "Mock generation needs a template video in R2. Upload seed assets first.",
    });
    return;
  }
  const obj = await env.BUCKET.get(sourceKey);
  if (!obj) {
    // Create a tiny placeholder mp4-ish bytes so pipeline still delivers something local
    const placeholder = new TextEncoder().encode("MOCK_VIDEO_PLACEHOLDER");
    const saved = await putUpload(env, {
      walletId: job.wallet_id,
      accessToken: job.access_token,
      kind: "output",
      contentType: "video/mp4",
      body: placeholder,
      bytes: placeholder.byteLength,
      keyPrefix: `outputs/${job.wallet_id}`,
    });
    await markJob(env.DB, jobId, {
      status: "succeeded",
      output_asset_id: saved.id,
      output_r2_key: saved.key,
      error_code: "mock_placeholder",
      error_message: null,
    });
    const { notifyJobReady } = await import("./email");
    await notifyJobReady(env, jobId);
    return;
  }
  const saved = await putUpload(env, {
    walletId: job.wallet_id,
    accessToken: job.access_token,
    kind: "output",
    contentType: obj.httpMetadata?.contentType || "video/mp4",
    body: obj.body,
    bytes: obj.size,
    keyPrefix: `outputs/${job.wallet_id}`,
  });
  await markJob(env.DB, jobId, {
    status: "succeeded",
    output_asset_id: saved.id,
    output_r2_key: saved.key,
  });
  const { notifyJobReady } = await import("./email");
  await notifyJobReady(env, jobId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isPublicBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return !(
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export { randomId };
