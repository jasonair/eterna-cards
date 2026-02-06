import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

// DELETE endpoint to remove a purchase order and its line items
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    // Get the PO ID from query params
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('id');

    if (!poId) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }

    // Check if PO exists
    const { data: po, error: fetchError } = await supabase
      .from('purchaseorders')
      .select('*')
      .eq('id', poId)
      .single();

    if (fetchError || !po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Get count of associated line items before deletion
    const { count: deletedLines } = await supabase
      .from('polines')
      .select('*', { count: 'exact', head: true })
      .eq('purchaseorderid', poId);

    // Delete the purchase order (cascade will handle line items)
    const { error: deleteError } = await supabase
      .from('purchaseorders')
      .delete()
      .eq('id', poId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete purchase order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase order deleted successfully',
      deleted: {
        purchaseOrder: po,
        lineItemsCount: deletedLines || 0,
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
