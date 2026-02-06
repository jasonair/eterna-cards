import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to add new line items
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth(request);
    // Parse the request body
    const requestData = await request.json();

    if (!requestData.purchaseOrderId) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }

    // Handle both single line and multiple lines
    const lines = requestData.lines || [requestData];
    const purchaseOrderId = requestData.purchaseOrderId;

    // Validate required fields for each line
    const requiredFields = ['description', 'quantity', 'unitCostExVAT', 'lineTotalExVAT'];
    for (const lineData of lines) {
      for (const field of requiredFields) {
        if (lineData[field] === undefined || lineData[field] === null) {
          return NextResponse.json(
            { error: `${field} is required for all line items` },
            { status: 400 }
          );
        }
      }
    }

    // Create the line items
    const linesToCreate = lines.map((line: any) => ({
      purchaseorderid: purchaseOrderId,
      description: line.description,
      suppliersku: line.supplierSku || null,
      quantity: line.quantity,
      unitcostexvat: line.unitCostExVAT,
      linetotalexvat: line.lineTotalExVAT,
      rrp: line.rrp ?? null,
    }));

    const { data: newLines, error } = await supabase
      .from('polines')
      .insert(linesToCreate)
      .select();

    if (error || !newLines) {
      console.error('Create PO lines DB error:', error);
      throw new Error(`Failed to create PO lines: ${error?.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `${newLines.length} line item(s) added successfully`,
      data: newLines,
    });
  } catch (error) {
    console.error('Add line item error:', error);
    return NextResponse.json(
      { error: 'Failed to add line item' },
      { status: 500 }
    );
  }
}
