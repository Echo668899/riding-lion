# Riding Lion

Mobile-first English web app: upload one authorized portrait, buy credits, get a silent 9:16 AI short where you replace the template performer. No prompts, no model knobs.

**Stack:** TypeScript · Cloudflare Workers · D1 · private R2 · Hono · Vite/React · fal Seedance 2.5 US (`task: "editing"`) · mock payments (Creem blocked for this product category)

## Quick start (local)

```bash
npm install
cp .dev.vars.example .dev.vars
# edit MEDIA_SIGNING_SECRET

npm run db:migrate:local
chmod +x scripts/seed-local-assets.sh scripts/accept-smoke.sh
./scripts/seed-local-assets.sh

npm run build:client
npx wrangler dev
```

Open `http://127.0.0.1:8787`.

Template plate lives at `assets/riding-lion-tpl.mp4`. `npm run seed:assets:local` copies it into R2 keys `templates/turn-smile/v1/source.mp4` and `sample-output.mp4`. Optional: add `cover.jpg` / `sample-photo.jpg` under `assets/templates/turn-smile/v1/`.

### Acceptance smoke

With `wrangler dev` running:

```bash
./scripts/accept-smoke.sh http://127.0.0.1:8787
```

Manual UI path: preview template → upload photo → choose **3 credits ($19.99)** → simulate pay → wait for job → refresh `/r/:accessToken` → download.

## Deploy (Cloudflare)

### One-time resource bootstrap (local)

```bash
npx wrangler login
chmod +x scripts/bootstrap-cf.sh scripts/seed-remote-assets.sh
./scripts/bootstrap-cf.sh
# paste the printed database_id into wrangler.jsonc, commit, then:
npm run db:migrate:remote
./scripts/seed-remote-assets.sh
```

### GitHub Actions (recommended)

Workflow: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) — on push to `main`/`master` (or manual `workflow_dispatch`):

1. Build client → apply remote D1 migrations → `wrangler deploy` → sync Worker secrets → optional R2 seed

**Repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Required | Purpose |
|--------|----------|---------|
| `CLOUDFLARE_API_TOKEN` | yes | Token with Workers Edit + D1 Edit + Account / R2 edit as needed |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Cloudflare account id |
| `MEDIA_SIGNING_SECRET` | yes | HMAC for `/api/media` |
| `APP_BASE_URL` | yes | e.g. `https://ridinglion.com` |
| `FAL_KEY` | for live gen | fal API key |
| `RESEND_API_KEY` | for email | Resend send/receive |
| `RESEND_WEBHOOK_SECRET` | optional | Guard inbound webhook |

**Repo variable** (optional): `SEED_R2_ON_DEPLOY=true` to upload template media on each deploy.

Before the first Actions deploy succeeds, `wrangler.jsonc` must contain a **real** D1 `database_id` (not the local placeholder) and the R2 bucket must exist.

### Manual deploy

1. Create D1 + R2; put real IDs into `wrangler.jsonc`.
2. `npm run build:client`
3. `npm run db:migrate:remote`
4. `./scripts/seed-remote-assets.sh`
5. Set secrets (`MEDIA_SIGNING_SECRET`, `FAL_KEY`, `RESEND_API_KEY`, `APP_BASE_URL`, …)
6. Keep `MOCK_GENERATION=false` once `FAL_KEY` is set.
7. `npm run deploy`
8. **Resend:** verify `ridinglion.com`, inbound `support@ridinglion.com`, webhook → `https://your-domain/api/webhooks/resend`

## Environment

| Name | Where | Purpose |
|------|--------|---------|
| `MEDIA_SIGNING_SECRET` | secret | HMAC for `/api/media/:token` (TTL covers fal queue; default 7200s) |
| `FAL_KEY` | secret | fal API key — uploads template/portrait to fal CDN then runs Seedance editing |
| `MOCK_GENERATION` | var | `true` skips fal (even if key set); without `FAL_KEY`, mock is always on |
| `APP_BASE_URL` | var/secret | Public origin for signed URLs + webhooks |
| `ASSET_RETENTION_DAYS` | var | Default `7` |
| `FAL_MODEL_PATH` | var | `bytedance/seedance-2.5/us/reference-to-video` |
| `RESEND_API_KEY` | secret | Resend API key for send + receiving API |
| `EMAIL_FROM` | var | Default `Riding Lion <support@ridinglion.com>` |
| `RESEND_WEBHOOK_SECRET` | secret | Optional guard for inbound webhook |

## Operator: swap template without frontend changes

1. Upload new media to R2 under a new version prefix.
2. Insert a new `template_versions` row and bump `templates.version` / keys.
3. Existing jobs keep their `template_version_id` snapshot.

## Credits & payments

- 1 finished clip = **1 credit**
- Packs (D1 seed): 1 / **3 ($19.99, recommended)** / 6 ($29.99)
- Checkout is **mock only** — UI states *Simulated payment — you will not be charged*
- `PaymentProvider` interface is ready for a future provider that explicitly allows this use case (not Creem production)

## API map

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/catalog` | Active template + packs + signed media |
| POST | `/api/uploads` | Photo → R2 + wallet token |
| POST | `/api/payments/checkout` | Create pending mock payment |
| POST | `/api/payments/mock/confirm` | Grant credits (idempotent) |
| POST | `/api/payments/mock/cancel` | Cancel unpaid |
| POST | `/api/webhooks/payment` | Provider-shaped paid/cancel notify |
| POST | `/api/generations` | Debit 1 credit + start workflow (requires email) |
| GET | `/api/generations/:id` | Poll job |
| GET | `/api/session/:accessToken` | Recover after refresh |
| POST | `/api/wallet/email` | Save notify email on wallet |
| GET | `/api/wallet/email` | Read saved email |
| POST | `/api/webhooks/fal` | fal queue completion |
| POST | `/api/webhooks/resend` | Resend inbound (`email.received`) → D1 + auto-ack |
| GET | `/api/media/:token` | Signed private media |
| POST | `/api/generations/:id/refund` | Failed job → restore credit (mock) |
| DELETE | `/api/assets/:id` | User delete |

### Email (Resend)

- **From / reply-to:** `support@ridinglion.com`
- On job success, Worker emails the private `/r/:token?job=…` link via Resend
- Inbound mail to support@ is stored in `inbound_emails` and auto-acknowledged when `RESEND_API_KEY` is set
- **Passwordless login:** `POST /api/auth/request-code` + `/api/auth/verify` bind credits & jobs to email; `/account` lists balance and clips (7-day retention)

See [DELIVERY.md](./DELIVERY.md) for tested vs simulated vs missing production prerequisites.

## SEO / GEO

Keyword map, page structure, and schema inventory: [SEO.md](./SEO.md).

Indexable routes: `/`, `/privacy`. Private: `/checkout`, `/r/*` (`noindex`). Dynamic `robots.txt` + absolute `sitemap.xml` served by the Worker.
