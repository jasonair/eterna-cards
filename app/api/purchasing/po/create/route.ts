import { NextRequest, NextResponse } from 'next/server';
import { createPurchaseOrder } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to create a new purchase order
export async function POST(request: NextRequest) {
  try {
    const poData = await request.json();

    // Validate required fields
    if (!poData.supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    if (!poData.invoiceNumber || !poData.invoiceNumber.trim()) {
      return NextResponse.json(
        { error: 'Invoice number is required' },
        { status: 400 }
      );
    }

    if (!poData.currency) {
      return NextResponse.json(
        { error: 'Currency is required' },
        { status: 400 }
      );
    }

    // Create the purchase order
    const purchaseOrderId = await createPurchaseOrder({
      supplierId: poData.supplierId,
      invoiceNumber: poData.invoiceNumber.trim(),
      invoiceDate: poData.invoiceDate || null,
      currency: poData.currency,
      paymentTerms: poData.paymentTerms || null,
      imageUrl: null,
      imageUrls: [],
    });

    return NextResponse.json({
      success: true,
      message: 'Purchase order created successfully',
      data: { id: purchaseOrderId },
    });
  } catch (error) {
    console.error('Create PO error:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
