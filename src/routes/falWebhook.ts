import { Hono } from "hono";
import { getJobByFalRequestId } from "../lib/db";
import { markJob, saveOutputFromUrl } from "../lib/generation";
import { mapFalUserError } from "../lib/fal";

type Bindings = { Bindings: Env };

export const falWebhookRoutes = new Hono<Bindings>();

/**
 * fal queue webhook. Idempotent on request_id.
 * Signature verification can be added when deploying with public URL + JWKS.
 */
falWebhookRoutes.post("/webhooks/fal", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    request_id?: string;
    status?: string;
    payload?: { video?: { url?: string }; detail?: unknown };
    error?: string;
  } | null;

  if (!body?.request_id) {
    return c.json({ ok: false }, 400);
  }

  const job = await getJobByFalRequestId(c.env.DB, body.request_id);
  if (!job) {
    // Acknowledge unknown to stop retries for orphaned events
    return c.json({ ok: true, ignored: true });
  }

  if (["succeeded", "failed", "storage_failed"].includes(job.status)) {
    return c.json({ ok: true, duplicate: true, status: job.status });
  }

  if (body.status === "ERROR" || body.error) {
    const mapped = mapFalUserError(422, body);
    await markJob(c.env.DB, job.id, {
      status: "failed",
      error_code: mapped.code,
      error_message: body.error || mapped.message,
    });
    return c.json({ ok: true, status: "failed" });
  }

  const videoUrl = body.payload?.video?.url;
  if (!videoUrl) {
    // Incomplete / in-progress webhook — acknowledge without failing the job
    if (body.status && body.status !== "OK" && body.status !== "COMPLETED") {
      return c.json({ ok: true, ignored: true, status: body.status });
    }
    await markJob(c.env.DB, job.id, {
      status: "failed",
      error_code: "fal_empty_result",
      error_message: "Generation finished but no video was returned.",
    });
    return c.json({ ok: true, status: "failed" });
  }

  try {
    await saveOutputFromUrl(c.env, job, videoUrl);
  } catch {
    // saveOutputFromUrl already marked storage_failed when applicable
  }

  return c.json({ ok: true });
});
