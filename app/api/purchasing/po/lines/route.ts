import { NextRequest, NextResponse } from 'next/server';
import { updatePOLine, deletePOLine, createPOLines } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// PUT endpoint to update a line item
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('id');

    if (!lineId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      );
    }

    // Parse the request body
    const updates = await request.json();

    // Validate the updates (basic validation)
    const allowedFields = ['description', 'supplierSku', 'quantity', 'unitCostExVAT', 'lineTotalExVAT'];
    const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Invalid fields: ${invalidFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the line item
    const updatedLine = await updatePOLine(lineId, updates);

    if (!updatedLine) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Line item updated successfully',
      data: updatedLine,
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
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('id');

    if (!lineId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      );
    }

    // Delete the line item
    const deleted = await deletePOLine(lineId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      );
    }

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
