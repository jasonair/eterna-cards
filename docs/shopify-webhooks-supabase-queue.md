# Shopify Webhooks -> Supabase Inventory Sync (Supabase-backed queue)

## Overview
This repository contains a Next.js (App Router) webhook integration that ingests Shopify order-related webhooks and updates inventory in Supabase.

Key design goals:
- Webhook endpoint responds quickly with HTTP 200.
- All processing is reliable (retries + audit trail).
- Inventory updates are atomic and idempotent (no double-decrement on retries).
- Negative inventory is handled via clamp-to-zero + conflict logging.

## High-level Architecture
- Shopify sends a webhook request to the Next.js API route.
- The API route:
  - validates request authenticity (HMAC)
  - prevents replay (webhook id tracking)
  - rate limits
  - logs receipt
  - enqueues work into a Supabase table-backed queue
  - returns 200 immediately
- A worker/processor:
  - claims queued jobs from Supabase
  - applies inventory deltas using Postgres RPC functions
  - retries with exponential backoff
  - dead-letters permanently failing jobs

## Files added
- `app/api/webhooks/shopify/orders/route.ts`
  - Shopify webhook ingestion endpoint.

- `app/api/internal/shopify/webhooks/process/route.ts`
  - Worker entrypoint (HTTP). Call this on a schedule (cron) or from an always-on worker.

- `lib/shopify/webhooks/verify.ts`
  - HMAC verification.

- `lib/shopify/webhooks/types.ts`
  - TypeScript payload types for supported webhook topics.

- `lib/shopify/webhooks/normalize.ts`
  - Normalizes topic-specific payloads into a consistent list of inventory effects.

- `lib/shopify/webhooks/supabase.ts`
  - Supabase helpers (rate limit, dedupe insert, enqueue job, logging, mapping variant/sku -> product).

- `lib/shopify/webhooks/processor.ts`
  - Job processor logic, retries/backoff, dead-lettering.

- `supabase/migrations/20260108180000_shopify_webhook_queue.sql`
  - Database tables + Postgres functions (RPC) used by the integration.

## Supported Shopify webhook topics
The webhook endpoint accepts the following topics:
- `orders/create` (decrement inventory)
- `orders/cancelled` (increment inventory)
- `refunds/create` (increment inventory only for refunded line items)

The topic is read from:
- `X-Shopify-Topic`

## Security: HMAC verification
The webhook endpoint verifies Shopify authenticity via:
- header: `X-Shopify-Hmac-SHA256`
- secret: `SHOPIFY_WEBHOOK_SECRET`

Implementation detail:
- HMAC is computed over the **raw request body**.

## Replay prevention
Shopify includes a unique webhook delivery id in:
- `X-Shopify-Webhook-Id`

We store these ids in `processed_webhooks`.
If the same `webhook_id` is received again, we skip processing and return 200.

## Rate limiting
Rate limiting is implemented using a Supabase Postgres function:
- `ratelimit_shopify_webhook(ip, limit, window_seconds) -> boolean`

The webhook route calls this before doing any heavy work.

## Inventory update semantics
Inventory is stored in the existing Supabase table:
- `inventory` (column `quantityonhand`)

Negative inventory behavior:
- If an operation would drive inventory below 0, it is clamped to 0.
- A record is written to `inventory_conflicts` with the attempted delta and context.

## Idempotent per-product application
To avoid double applying an inventory delta (common with webhook retries and job retries), we apply effects using:
- `webhook_inventory_effects` table (primary key `(webhook_id, product_id)`)
- `apply_shopify_inventory_effect(webhook_id, product_id, delta, context)` RPC

This ensures:
- For a given webhook id and product id, the delta can only be applied once.

## Variant/SKU mapping
Preferred mapping:
- `shopify_variant_map.shopify_variant_id -> product_id`

Fallback mapping:
- Attempt SKU match against `products.primarysku`, `products.suppliersku`, and `products.barcodes`.

If mapping fails, the job is retried and eventually dead-lettered.

## Queue tables
Queue table:
- `shopify_webhook_jobs`
  - `status`: `queued | processing | succeeded | dead`
  - `attempts`, `max_attempts`
  - `run_at`: next scheduled run (used for backoff)

Manual review / dead-letter table:
- `failed_webhook_jobs`

Audit trail:
- `webhook_logs`

## Processing jobs (cron/worker)
HTTP worker route:
- `POST /api/internal/shopify/webhooks/process?maxJobs=10`

Optional auth:
- Set env var `WEBHOOK_PROCESSOR_SECRET`
- Provide header `x-cron-secret: <value>`

This worker uses:
- `claim_shopify_webhook_jobs(max_jobs, worker_id)` to claim jobs safely.

Retry strategy:
- Exponential backoff starting at 5s, doubling each attempt, capped at 30 minutes.

## Environment variables
Required:
- `SHOPIFY_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (note: this repo currently expects `SUPABASE_SERVICE_ROLE_KEY`)

Optional:
- `WEBHOOK_PROCESSOR_SECRET` (protects internal process route)

## Near-realtime considerations
To achieve <30s end-to-end latency:
- run the processor route very frequently.

To achieve <5s reliably:
- run an always-on worker that polls for jobs every 1–2 seconds (still using Supabase tables + RPC claims).

## Example payloads
Example payloads are defined in:
- `lib/shopify/webhooks/examples.ts`

## Notes / Next steps
- Add automated tests (HMAC unit tests + integration tests for inventory updates).
- Add optional outbound Shopify inventory sync queue if you need to push inventory changes back to Shopify while respecting Admin API rate limits.
