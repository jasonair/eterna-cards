import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateSupplier } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to create a new supplier
export async function POST(request: NextRequest) {
  try {
    const supplierData = await request.json();

    // Validate required fields
    if (!supplierData.name || !supplierData.name.trim()) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Create the supplier (will find existing if name matches)
    const supplierId = await findOrCreateSupplier({
      name: supplierData.name.trim(),
      address: supplierData.address || null,
      email: supplierData.email || null,
      phone: supplierData.phone || null,
      vatNumber: supplierData.vatNumber || null,
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
