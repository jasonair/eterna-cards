import { NextRequest, NextResponse } from 'next/server';
import { addBarcodeToProduct } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidUUID, sanitizeString, findUnexpectedFields } from '@/lib/validation';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);

    // SECURITY: Rate limit per IP + user
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    const body = await request.json();

    // SECURITY: Reject unexpected fields
    const unexpected = findUnexpectedFields(body, ['productId', 'barcode']);
    if (unexpected.length > 0) {
      return NextResponse.json(
        { error: `Unexpected fields: ${unexpected.join(', ')}` },
        { status: 400 },
      );
    }

    const productId = body?.productId;
    const barcode = sanitizeString(body?.barcode, 200);

    // SECURITY: Validate UUID format for productId
    if (!isValidUUID(productId)) {
      return NextResponse.json(
        { error: 'productId must be a valid UUID' },
        { status: 400 }
      );
    }

    if (!barcode) {
      return NextResponse.json(
        { error: 'barcode is required (max 200 characters)' },
        { status: 400 }
      );
    }

    const product = await addBarcodeToProduct(productId, barcode);

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Add barcode error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add barcode' },
      { status: 500 }
    );
  }
}
