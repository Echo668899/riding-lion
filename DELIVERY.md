# Delivery notes — Riding Lion v0.1

## Implemented

- Single-template mobile English experience (Riding Lion branding)
- Template metadata versioning in D1; jobs bind `template_version_id`
- Credit packs: 1 / 3 ($19.99 recommended) / 6 ($29.99); 1 clip = 1 credit
- Photo upload (JPG/PNG/WebP), preview/replace, 7-day retention copy, delete API
- Mock checkout with explicit “Simulated payment — you will not be charged”
- Idempotent payment confirm + webhook-shaped notify; cancel unpaid
- Generation job state machine, credit debit, Cloudflare Workflow (+ `waitUntil` fallback)
- fal Seedance US editing client (`task: editing`, 720p, H264, `generate_audio: false`), `request_id` persistence, webhook handler, no double-submit when `fal_request_id` exists
- Private R2 + HMAC signed `/api/media` URLs for browser + fal fetch
- Result page recover-by-token, download, delete, failed reason + mock refund
- Migrations, `.dev.vars.example`, seed asset script, smoke script, README
- Resend email: collect notify address, send result link from `support@ridinglion.com`, inbound webhook → `inbound_emails` + auto-ack

## Simulated / local-only

| Area | Behavior |
|------|----------|
| Payments | Mock provider only — no real card charge; Creem production intentionally not wired |
| Generation without `FAL_KEY` (or `MOCK_GENERATION=true`) | Copies template/sample as “output”; with key + mock off, uploads R2 media to fal CDN and runs Seedance editing |
| Refunds | Auto-approves and restores 1 credit; no PSP refund |
| Template media | Repo ships tiny JPEG + stub MP4 keys until you upload real 9:16 silent plate |
| fal webhook auth | Endpoint is idempotent; JWKS signature verify not enforced in v0.1 (add before public prod) |
| Email without `RESEND_API_KEY` | Notify + inbound auto-ack are skipped/logged; webhook still stores inbound rows |

## Still required for production quality

1. **fal real-person / likeness permission** on the US Seedance account
2. Real silent **9:16** template + cover + sample photo + sample finished clip in R2
3. Payment provider that **allows** real-person replacement products (not Creem)
4. Set `MOCK_GENERATION=false`, secrets, real D1/R2 IDs, `APP_BASE_URL`
5. After permission: validate **3 authorized portraits** on the same template (face match, turn identity, motion lock)
6. Harden fal webhook signature verification + observability alerts
7. **Resend:** verify `ridinglion.com`, inbound for `support@ridinglion.com`, `RESEND_API_KEY`, webhook → `/api/webhooks/resend`

## Acceptance checklist

Local smoke (`scripts/accept-smoke.sh` + refund probe) on 2026-11-16:

- [x] Preview template on home / catalog signed media
- [x] Upload photo
- [x] Select 3 credits → simulated pay → credits granted
- [x] Auto generation (mock) succeeds; `/api/session/:token` recovers job + download URLs
- [x] Cancel unpaid checkout
- [x] Duplicate payment notify does not double-credit
- [x] Model reject → readable error + mock refund (idempotent, credit restored once)
- [ ] Forced storage failure path marks `storage_failed` (manual/fault injection; code path present in `saveOutputFromUrl`)
- [ ] UI click-through with real 9:16 template after you drop files into `assets/templates/turn-smile/v1/`
- [ ] Live fal real-person generations (needs `FAL_KEY` + likeness permission)
- [ ] Live Resend send/receive via support@ridinglion.com (needs `RESEND_API_KEY` + domain/inbound)
