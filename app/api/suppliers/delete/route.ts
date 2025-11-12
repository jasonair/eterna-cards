import { NextRequest, NextResponse } from 'next/server';
import { getDb, deleteSupplier } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// DELETE endpoint to remove a supplier and all associated data
export async function DELETE(request: NextRequest) {
  try {
    // Get the supplier ID from query params
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('id');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      );
    }

    // Get the database instance to check if supplier exists
    const db = await getDb();
    await db.read();

    // Check if supplier exists
    const supplier = db.data.suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Delete the supplier and all associated data
    const result = await deleteSupplier(supplierId);

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully',
      deleted: {
        supplier: supplier.name,
        purchaseOrders: result.deletedPurchaseOrders,
        lineItems: result.deletedLines,
      },
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
