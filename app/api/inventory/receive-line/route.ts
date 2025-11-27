import { NextRequest, NextResponse } from 'next/server';
import { receiveStockForProduct } from '@/lib/db';

// Force Node.js runtime for Supabase admin client
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = body?.productId as string | undefined;
    const poLineId = body?.poLineId as string | undefined;
    const quantityRaw = body?.quantity;
    const quantity = typeof quantityRaw === 'number' ? quantityRaw : Number(quantityRaw);

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 },
      );
    }

    if (!poLineId || typeof poLineId !== 'string') {
      return NextResponse.json(
        { error: 'poLineId is required' },
        { status: 400 },
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a positive number' },
        { status: 400 },
      );
    }

    const result = await receiveStockForProduct({ productId, quantity, poLineId });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Receive stock (line) error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to receive stock for line' },
      { status: 500 },
    );
  }
}
