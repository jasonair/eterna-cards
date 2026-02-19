import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { clearCache } from '@/lib/cache';
import { applyRateLimit } from '@/lib/rate-limit';
import { isValidUUID } from '@/lib/validation';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// PUT endpoint to update a line item
export async function PUT(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('id');

    if (!isValidUUID(lineId)) {
      return NextResponse.json(
        { error: 'Line item ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updates = await request.json();

    // Validate the updates (basic validation)
    const allowedFields = ['description', 'supplierSku', 'quantity', 'unitCostExVAT', 'lineTotalExVAT', 'rrp'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Invalid fields: ${invalidFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Map camelCase fields to DB column names
    // SECURITY: Verify the line belongs to a PO owned by the authenticated user
    const { data: lineCheck, error: lineCheckError } = await supabase
      .from('polines')
      .select('id, purchaseorderid, purchaseorders!inner(user_id)')
      .eq('id', lineId)
      .single();

    if (lineCheckError || !lineCheck || (lineCheck.purchaseorders as any)?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    const mappedUpdates: Record<string, any> = {};
    if (updates.description !== undefined) mappedUpdates.description = updates.description;
    if (updates.supplierSku !== undefined) mappedUpdates.suppliersku = updates.supplierSku;
    if (updates.quantity !== undefined) mappedUpdates.quantity = updates.quantity;
    if (updates.unitCostExVAT !== undefined) mappedUpdates.unitcostexvat = updates.unitCostExVAT;
    if (updates.lineTotalExVAT !== undefined) mappedUpdates.linetotalexvat = updates.lineTotalExVAT;
    if (updates.rrp !== undefined) mappedUpdates.rrp = updates.rrp;

    const { data, error } = await supabase
      .from('polines')
      .update(mappedUpdates)
      .eq('id', lineId)
      .select()
      .single();

    if (error || !data) {
      console.error('Update PO line DB error:', error);
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    clearCache(`purchasing_po_view_v1_${user.id}`);
    clearCache(`inventory_snapshot_v1_${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Line item updated successfully',
      data,
    });
  } catch (error) {
    console.error('Update line item error:', error);
    return NextResponse.json(
      { error: 'Failed to update line item' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a line item
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    const blocked = applyRateLimit(request, user.id);
    if (blocked) return blocked;

    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('id');

    if (!isValidUUID(lineId)) {
      return NextResponse.json(
        { error: 'Line item ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the line belongs to a PO owned by the authenticated user
    const { data: lineCheck, error: lineCheckError } = await supabase
      .from('polines')
      .select('id, purchaseorderid, purchaseorders!inner(user_id)')
      .eq('id', lineId)
      .single();

    if (lineCheckError || !lineCheck || (lineCheck.purchaseorders as any)?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('polines')
      .delete()
      .eq('id', lineId);

    if (error) {
      console.error('Delete PO line DB error:', error);
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    clearCache(`purchasing_po_view_v1_${user.id}`);
    clearCache(`inventory_snapshot_v1_${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Line item deleted successfully',
    });
  } catch (error) {
    console.error('Delete line item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete line item' },
      { status: 500 }
    );
  }
}
