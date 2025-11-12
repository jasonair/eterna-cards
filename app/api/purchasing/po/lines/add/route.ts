import { NextRequest, NextResponse } from 'next/server';
import { createPOLines } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

// POST endpoint to add new line items
export async function POST(request: NextRequest) {
  try {
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
      purchaseOrderId,
      description: line.description,
      supplierSku: line.supplierSku || null,
      quantity: line.quantity,
      unitCostExVAT: line.unitCostExVAT,
      lineTotalExVAT: line.lineTotalExVAT,
    }));

    const newLines = await createPOLines(linesToCreate);

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
