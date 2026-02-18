import { NextRequest, NextResponse } from 'next/server';
import { receiveStockForProduct } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidUUID, isValidPositiveNumber, findUnexpectedFields } from '@/lib/validation';

// Force Node.js runtime for Supabase admin client
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // SECURITY: Rate limit per IP + user
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    const body = await request.json();

    // SECURITY: Reject unexpected fields
    const unexpected = findUnexpectedFields(body, ['productId', 'poLineId', 'quantity']);
    if (unexpected.length > 0) {
      return NextResponse.json(
        { error: `Unexpected fields: ${unexpected.join(', ')}` },
        { status: 400 },
      );
    }

    const productId = body?.productId;
    const poLineId = body?.poLineId;
    const quantityRaw = body?.quantity;
    const quantity = typeof quantityRaw === 'number' ? quantityRaw : Number(quantityRaw);

    // SECURITY: Validate UUID format for IDs
    if (!isValidUUID(productId)) {
      return NextResponse.json(
        { error: 'productId must be a valid UUID' },
        { status: 400 },
      );
    }

    if (!isValidUUID(poLineId)) {
      return NextResponse.json(
        { error: 'poLineId must be a valid UUID' },
        { status: 400 },
      );
    }

    if (!isValidPositiveNumber(quantity)) {
      return NextResponse.json(
        { error: 'quantity must be a positive number (max 1,000,000,000)' },
        { status: 400 },
      );
    }

    const result = await receiveStockForProduct({ productId, quantity, poLineId });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Receive stock (line) error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to receive stock for line' },
      { status: 500 },
    );
  }
}
