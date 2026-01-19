import { NextRequest, NextResponse } from 'next/server';

import { processShopifyWebhookJobs } from '@/lib/shopify/webhooks/processor';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_PROCESSOR_SECRET;
  if (secret) {
    const provided = request.headers.get('x-cron-secret');
    if (!provided || provided !== secret) {
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
