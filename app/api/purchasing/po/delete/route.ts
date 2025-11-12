import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// DELETE endpoint to remove a purchase order and its line items
export async function DELETE(request: NextRequest) {
  try {
    // Get the PO ID from query params
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('id');

    if (!poId) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }

    // Get the database instance
    const db = await getDb();
    await db.read();

    // Check if PO exists
    const poIndex = db.data.purchaseOrders.findIndex(po => po.id === poId);
    if (poIndex === -1) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Remove the purchase order
    const deletedPO = db.data.purchaseOrders.splice(poIndex, 1)[0];

    // Remove all associated line items
    const deletedLines = db.data.poLines.filter(line => line.purchaseOrderId === poId);
    db.data.poLines = db.data.poLines.filter(line => line.purchaseOrderId !== poId);

    // Save changes
    await db.write();

    return NextResponse.json({
      success: true,
      message: 'Purchase order deleted successfully',
      deleted: {
        purchaseOrder: deletedPO,
        lineItemsCount: deletedLines.length,
      },
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
