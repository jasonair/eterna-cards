import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to merge two purchase orders
export async function POST(request: NextRequest) {
  try {
    const { sourcePOId, targetPOId } = await request.json();

    if (!sourcePOId || !targetPOId) {
      return NextResponse.json(
        { error: 'Both source and target PO IDs are required' },
        { status: 400 }
      );
    }

    if (sourcePOId === targetPOId) {
      return NextResponse.json(
        { error: 'Cannot merge a PO with itself' },
        { status: 400 }
      );
    }

    // Get the database instance
    const db = await getDb();
    await db.read();

    // Find both POs
    const sourcePO = db.data.purchaseOrders.find(po => po.id === sourcePOId);
    const targetPO = db.data.purchaseOrders.find(po => po.id === targetPOId);

    if (!sourcePO || !targetPO) {
      return NextResponse.json(
        { error: 'One or both purchase orders not found' },
        { status: 404 }
      );
    }

    // Get all line items from source PO
    const sourceLines = db.data.poLines.filter(line => line.purchaseOrderId === sourcePOId);

    // Move all line items from source to target
    sourceLines.forEach(line => {
      line.purchaseOrderId = targetPOId;
    });

    // Remove the source PO
    db.data.purchaseOrders = db.data.purchaseOrders.filter(po => po.id !== sourcePOId);

    // Save changes
    await db.write();

    return NextResponse.json({
      success: true,
      message: 'Purchase orders merged successfully',
      data: {
        targetPOId,
        mergedLineCount: sourceLines.length,
      },
    });
  } catch (error) {
    console.error('Merge PO error:', error);
    return NextResponse.json(
      { error: 'Failed to merge purchase orders' },
      { status: 500 }
    );
  }
}
