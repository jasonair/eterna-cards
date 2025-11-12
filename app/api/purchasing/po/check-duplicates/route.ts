import { NextRequest, NextResponse } from 'next/server';
import { findDuplicatePurchaseOrders } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierName, invoiceNumber, invoiceDate, poLines } = body;

    // Validate required fields
    if (!supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    if (!poLines || !Array.isArray(poLines) || poLines.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const duplicates = await findDuplicatePurchaseOrders(
      supplierName,
      invoiceNumber || null,
      invoiceDate || null,
      poLines
    );

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates.map(dup => ({
        id: dup.purchaseOrder.id,
        invoiceNumber: dup.purchaseOrder.invoiceNumber,
        invoiceDate: dup.purchaseOrder.invoiceDate,
        supplierName: dup.supplier.name,
        matchScore: Math.round(dup.matchScore),
        matchReasons: dup.matchReasons,
        lineCount: dup.lineCount,
        createdAt: dup.purchaseOrder.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to check for duplicates' },
      { status: 500 }
    );
  }
}
