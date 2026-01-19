import { NextRequest, NextResponse } from 'next/server';

import { verifyShopifyWebhookHmac } from '@/lib/shopify/webhooks/verify';
import type { ShopifyWebhookTopic } from '@/lib/shopify/webhooks/types';
import { normalizeShopifyWebhookWork } from '@/lib/shopify/webhooks/normalize';
import {
  enqueueWebhookJob,
  insertProcessedWebhook,
  logWebhookEvent,
  ratelimitShopifyWebhook,
} from '@/lib/shopify/webhooks/supabase';

export const runtime = 'nodejs';

const ALLOWED_TOPICS: ShopifyWebhookTopic[] = ['orders/create', 'orders/cancelled', 'refunds/create'];

function getFirstIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'SHOPIFY_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  const ip = getFirstIp(request);
  const allowed = await ratelimitShopifyWebhook({ ip, limit: 120, windowSeconds: 60 });
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const webhookId = request.headers.get('x-shopify-webhook-id');
  const topicHeader = request.headers.get('x-shopify-topic');
  const shop = request.headers.get('x-shopify-shop-domain') ?? 'unknown';
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');

  const rawBody = await request.text();

  const topic = (topicHeader ?? '') as ShopifyWebhookTopic;
  if (!ALLOWED_TOPICS.includes(topic)) {
    await logWebhookEvent({
      webhookId,
      topic: 'orders/create',
      shop,
      orderId: null,
      payload: { note: 'unsupported topic', topic: topicHeader, rawBody },
      status: 'skipped_unsupported_topic',
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ok = verifyShopifyWebhookHmac({ rawBody, hmacHeader, secret: webhookSecret });
  if (!ok) {
    await logWebhookEvent({
      webhookId,
      topic,
      shop,
      orderId: null,
      payload: { note: 'invalid hmac', rawBody },
      status: 'rejected',
    });

    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!webhookId) {
    await logWebhookEvent({
      webhookId: null,
      topic,
      shop,
      orderId: null,
      payload: { note: 'missing webhook id', rawBody },
      status: 'rejected',
    });

    return NextResponse.json({ error: 'Missing X-Shopify-Webhook-Id' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logWebhookEvent({
      webhookId,
      topic,
      shop,
      orderId: null,
      payload: { note: 'invalid json', rawBody },
      status: 'rejected',
    });

    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { inserted } = await insertProcessedWebhook({ webhookId, topic, shop });
  if (!inserted) {
    await logWebhookEvent({
      webhookId,
      topic,
      shop,
      orderId: null,
      payload,
      status: 'skipped_duplicate',
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const normalized = normalizeShopifyWebhookWork(topic, payload);

  await logWebhookEvent({
    webhookId,
    topic,
    shop,
    orderId: normalized.orderId,
    payload,
    status: 'received',
  });

  await enqueueWebhookJob({
    webhookId,
    topic,
    shop,
    orderId: normalized.orderId,
    payload,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
