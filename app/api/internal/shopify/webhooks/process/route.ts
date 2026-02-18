import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { processShopifyWebhookJobs } from '@/lib/shopify/webhooks/processor';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // SECURITY: Use timing-safe comparison to prevent timing attacks on secret
  const secret = process.env.WEBHOOK_PROCESSOR_SECRET;
  if (secret) {
    const provided = request.headers.get('x-cron-secret');
    if (
      !provided ||
      !crypto.timingSafeEqual(
        Buffer.from(secret, 'utf8'),
        Buffer.from(provided.padEnd(secret.length, '\0').slice(0, secret.length), 'utf8'),
      )
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const maxJobsRaw = request.nextUrl.searchParams.get('maxJobs');
  const maxJobs = maxJobsRaw ? Number(maxJobsRaw) : 10;

  const workerId = request.headers.get('x-worker-id') ?? 'nextjs-api';

  const result = await processShopifyWebhookJobs({
    workerId,
    maxJobs: Number.isFinite(maxJobs) ? Math.max(0, Math.min(100, maxJobs)) : 10,
  });

  return NextResponse.json({ success: true, data: result });
}
