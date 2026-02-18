import { NextRequest, NextResponse } from 'next/server';
import { deleteSupplier } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidUUID } from '@/lib/validation';

// DELETE endpoint to remove a supplier and all associated data
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    // Get the supplier ID from query params
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('id');

    // SECURITY: Validate UUID format
    if (!isValidUUID(supplierId)) {
      return NextResponse.json(
        { error: 'Supplier ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Check if supplier exists
    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (fetchError || !supplier) {
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
