export type FalSubmitResult = {
  request_id: string;
  status_url: string;
  response_url: string;
  cancel_url?: string;
  queue_position?: number;
};

export type FalStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | string;
  request_id?: string;
  error?: string;
  error_type?: string;
};

export type FalVideoResult = {
  video?: { url: string; content_type?: string; file_name?: string; file_size?: number };
  seed?: number;
};

const FAL_QUEUE = "https://queue.fal.run";
const FAL_UPLOAD_INIT = "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";

export function isMockGeneration(env: Env): boolean {
  if (!env.FAL_KEY) return true;
  return env.MOCK_GENERATION === "true";
}

export function mapFalUserError(status: number, body: unknown): { code: string; message: string } {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
  const lower = text.toLowerCase();
  if (status === 403 || lower.includes("permission") || lower.includes("not enabled")) {
    return {
      code: "fal_permission_denied",
      message:
        "Real-person replacement is not enabled on this fal account yet. Ask fal to enable likeness / face permissions for Seedance US.",
    };
  }
  if (
    status === 422 ||
    lower.includes("content_policy") ||
    lower.includes("likeness") ||
    lower.includes("real people") ||
    lower.includes("partner_validation")
  ) {
    return {
      code: "fal_content_rejected",
      message:
        "The model rejected this photo or template (likeness / content policy). Try a clear authorized solo portrait, or wait until real-person mode is approved for your fal account.",
    };
  }
  if (status === 401) {
    return { code: "fal_auth", message: "fal API key is missing or invalid." };
  }
  return {
    code: "fal_submit_failed",
    message: "Video generation could not be started. Please try again or request a refund if you were charged.",
  };
}

/**
 * Upload bytes to fal CDN so Seedance can fetch inputs without needing our public origin
 * (critical for local wrangler / private R2 signed URLs).
 */
export async function falUploadBytes(
  env: Env,
  input: { bytes: ArrayBuffer | Uint8Array; contentType: string; fileName: string },
): Promise<string> {
  const key = env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");

  const initRes = await fetch(FAL_UPLOAD_INIT, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content_type: input.contentType,
      file_name: input.fileName,
    }),
  });
  const initBody = (await initRes.json().catch(() => ({}))) as {
    upload_url?: string;
    file_url?: string;
    detail?: unknown;
  };
  if (!initRes.ok || !initBody.upload_url || !initBody.file_url) {
    const mapped = mapFalUserError(initRes.status, initBody);
    const err = new Error(mapped.message || "fal upload initiate failed") as Error & { code: string };
    err.code = mapped.code;
    throw err;
  }

  const putRes = await fetch(initBody.upload_url, {
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    body: input.bytes,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    const err = new Error(`fal CDN upload failed (${putRes.status}): ${text.slice(0, 200)}`) as Error & {
      code: string;
    };
    err.code = "fal_upload_failed";
    throw err;
  }
  return initBody.file_url;
}

export async function falUploadR2Object(
  env: Env,
  r2Key: string,
  fallbackName: string,
): Promise<string> {
  const obj = await env.BUCKET.get(r2Key);
  if (!obj) {
    const err = new Error(`Missing R2 object for fal upload: ${r2Key}`) as Error & { code: string };
    err.code = "missing_inputs";
    throw err;
  }
  const contentType = obj.httpMetadata?.contentType || guessContentType(r2Key);
  const bytes = await obj.arrayBuffer();
  const base = r2Key.split("/").pop() || fallbackName;
  return falUploadBytes(env, { bytes, contentType, fileName: base });
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function falSubmitEditing(
  env: Env,
  input: {
    prompt: string;
    videoUrl: string;
    imageUrl: string;
    webhookUrl?: string;
    endUserId?: string;
  },
): Promise<FalSubmitResult> {
  const key = env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured");
  const model = env.FAL_MODEL_PATH || "bytedance/seedance-2.5/us/reference-to-video";
  let url = `${FAL_QUEUE}/${model}`;
  if (input.webhookUrl) {
    url += `?fal_webhook=${encodeURIComponent(input.webhookUrl)}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: "editing",
      prompt: input.prompt,
      video_urls: [input.videoUrl],
      image_urls: [input.imageUrl],
      resolution: "720p",
      codec: "H264",
      generate_audio: false,
      end_user_id: input.endUserId,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mapped = mapFalUserError(res.status, body);
    const err = new Error(mapped.message) as Error & { code: string; status: number };
    err.code = mapped.code;
    err.status = res.status;
    throw err;
  }
  return body as FalSubmitResult;
}

export async function falGetStatus(env: Env, statusUrl: string): Promise<FalStatus> {
  const res = await fetch(statusUrl, {
    headers: { Authorization: `Key ${env.FAL_KEY}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`fal status failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body as FalStatus;
}

export async function falGetResult(env: Env, responseUrl: string): Promise<FalVideoResult> {
  const res = await fetch(responseUrl, {
    headers: { Authorization: `Key ${env.FAL_KEY}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mapped = mapFalUserError(res.status, body);
    const err = new Error(mapped.message) as Error & { code: string };
    err.code = mapped.code;
    throw err;
  }
  return body as FalVideoResult;
}
