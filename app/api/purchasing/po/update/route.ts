import { NextRequest, NextResponse } from 'next/server';
import { updatePurchaseOrder } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// PUT endpoint to update a purchase order
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('id');

    if (!poId) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updates = await request.json();

    // Validate the updates (basic validation)
    const allowedFields = ['supplierId', 'invoiceNumber', 'invoiceDate', 'currency', 'paymentTerms'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Invalid fields: ${invalidFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the PO
    const updatedPO = await updatePurchaseOrder(poId, updates);

    if (!updatedPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: updatedPO,
    });
  } catch (error) {
    console.error('Update PO error:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}
