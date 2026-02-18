import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateSupplier } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { applyRateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/validation';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to create a new supplier
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    const supplierData = await request.json();

    // SECURITY: Sanitize and validate all string inputs with length limits
    const name = sanitizeString(supplierData.name, 500);
    if (!name) {
      return NextResponse.json(
        { error: 'Supplier name is required (max 500 characters)' },
        { status: 400 }
      );
    }

    // Create the supplier (will find existing if name matches)
    const supplierId = await findOrCreateSupplier({
      name,
      address: sanitizeString(supplierData.address, 1000) || null,
      email: sanitizeString(supplierData.email, 254) || null,
      phone: sanitizeString(supplierData.phone, 50) || null,
      vatNumber: sanitizeString(supplierData.vatNumber, 50) || null,
      user_id: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier created successfully',
      data: { id: supplierId },
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
