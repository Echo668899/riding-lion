interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  GENERATION_WORKFLOW: Workflow;
  APP_NAME: string;
  ASSET_RETENTION_DAYS: string;
  SIGNED_URL_TTL_SECONDS: string;
  FAL_MODEL_PATH: string;
  MOCK_GENERATION: string;
  FAL_KEY?: string;
  MEDIA_SIGNING_SECRET: string;
  APP_BASE_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  RESEND_WEBHOOK_SECRET?: string;
}

interface Workflow {
  create(options: { id?: string; params: Record<string, unknown> }): Promise<{ id: string }>;
}
