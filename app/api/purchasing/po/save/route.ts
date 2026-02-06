import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateSupplier, createPurchaseOrder, createPOLines, syncInventoryFromPurchaseOrder, createOrUpdateInvoiceForPurchaseOrder } from '@/lib/db';
import { uploadInvoiceImages } from '@/lib/storage';
import { requireAuth } from '@/lib/auth-helpers';

interface SavePORequest {
  supplier: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
    vatNumber?: string;
  };
  purchaseOrder: {
    invoiceNumber?: string;
    invoiceDate?: string;
    originalCurrency?: string;
    paymentTerms?: string;
  };
  poLines: Array<{
    description: string;
    supplierSku?: string;
    quantity: number;
    unitCostExVAT: number;
    lineTotalExVAT: number;
    rrp?: number;
  }>;
  notes?: string;
  imageFiles?: File[];
}

// POST endpoint to save approved purchase order data
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const contentType = request.headers.get('content-type');
    let data: SavePORequest;
    let imageFiles: File[] = [];

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const jsonData = formData.get('data') as string;
      data = JSON.parse(jsonData);
      
      const fileCount = parseInt(formData.get('fileCount') as string || '0');
      for (let i = 0; i < fileCount; i++) {
        const file = formData.get(`file${i}`) as File;
        if (file) {
          imageFiles.push(file);
        }
      }
    } else {
      data = await request.json();
    }

    // Validate required fields
    if (!data.supplier?.name) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    if (!data.poLines || data.poLines.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Save to database
    try {
      // Create or find supplier
      const supplierId = await findOrCreateSupplier({
        name: data.supplier.name,
        address: data.supplier.address || null,
        email: data.supplier.email || null,
        phone: data.supplier.phone || null,
        vatNumber: data.supplier.vatNumber || null,
        user_id: user.id,
      });

      // Create purchase order first (we need the ID for image upload)
      const purchaseOrderId = await createPurchaseOrder({
        supplierId,
        invoiceNumber: data.purchaseOrder.invoiceNumber || null,
        invoiceDate: data.purchaseOrder.invoiceDate || null,
        currency: 'GBP', // All prices are converted to GBP by AI
        paymentTerms: data.purchaseOrder.paymentTerms || null,
        imageUrl: null,
        imageUrls: null,
        notes: data.notes || null,
        user_id: user.id,
      });

      // Upload images if provided
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        try {
          imageUrls = await uploadInvoiceImages(imageFiles, purchaseOrderId);
          
          // Update PO with image URLs
          const { updatePurchaseOrder } = await import('@/lib/db');
          await updatePurchaseOrder(purchaseOrderId, {
            imageUrl: imageUrls[0] || null,
            imageUrls: imageUrls,
          });
        } catch (uploadError) {
          console.error('Failed to upload images:', uploadError);
        }
      }

      // Create or update invoice record linked to this purchase order
      const invoice = await createOrUpdateInvoiceForPurchaseOrder({
        purchaseOrderId,
        supplierId,
        invoiceNumber: data.purchaseOrder.invoiceNumber || null,
        invoiceDate: data.purchaseOrder.invoiceDate || null,
        currency: 'GBP',
      });

      // Create PO lines
      const poLines = await createPOLines(
        data.poLines.map((line) => ({
          purchaseOrderId,
          description: line.description,
          supplierSku: line.supplierSku || null,
          quantity: line.quantity,
          unitCostExVAT: line.unitCostExVAT,
          lineTotalExVAT: line.lineTotalExVAT,
          rrp: line.rrp || null,
        }))
      );

      // Mark all extracted items as in transit for inventory management
      const inventorySync = await syncInventoryFromPurchaseOrder({
        supplierId,
        purchaseOrderId,
        poLines,
      });

      return NextResponse.json({
        success: true,
        data: {
          supplierId,
          purchaseOrderId,
          savedLines: poLines.length,
          inventorySync,
          invoice,
        },
      });
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save data to database' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
