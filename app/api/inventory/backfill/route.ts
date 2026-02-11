import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { syncInventoryFromPurchaseOrder, type POLine } from '@/lib/db';

// Force Node.js runtime for lowdb
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data: rawPurchaseOrders, error: poError } = await supabase
      .from('purchaseorders')
      .select('id, supplierid, user_id');

    if (poError || !rawPurchaseOrders) {
      console.error('Inventory backfill error: failed to load purchase orders', poError);
      return NextResponse.json(
        { error: 'Failed to backfill inventory from purchase orders' },
        { status: 500 }
      );
    }

    const { data: rawPoLines, error: linesError } = await supabase
      .from('polines')
      .select('*');

    if (linesError || !rawPoLines) {
      console.error('Inventory backfill error: failed to load PO lines', linesError);
      return NextResponse.json(
        { error: 'Failed to backfill inventory from purchase orders' },
        { status: 500 }
      );
    }

    const { data: existingTransit, error: transitError } = await supabase
      .from('transit')
      .select('purchaseorderid');

    if (transitError || !existingTransit) {
      console.error('Inventory backfill error: failed to load transit rows', transitError);
      return NextResponse.json(
        { error: 'Failed to backfill inventory from purchase orders' },
        { status: 500 }
      );
    }

    const purchaseOrders = rawPurchaseOrders.map((po: any) => ({
      id: po.id as string,
      supplierId: po.supplierid as string,
      user_id: po.user_id as string,
    }));

    const poLines: POLine[] = rawPoLines.map((line: any) => ({
      id: line.id as string,
      purchaseOrderId: line.purchaseorderid as string,
      description: line.description as string,
      supplierSku: (line.suppliersku as string | null) ?? null,
      quantity: Number(line.quantity) || 0,
      unitCostExVAT: Number(line.unitcostexvat) || 0,
      lineTotalExVAT: Number(line.linetotalexvat) || 0,
      rrp: line.rrp != null ? Number(line.rrp) : null,
    }));

    const poIdsWithTransit = new Set(
      existingTransit.map((t: any) => t.purchaseorderid as string)
    );

    const linesByPo = new Map<string, POLine[]>();
    for (const line of poLines) {
      const arr = linesByPo.get(line.purchaseOrderId) || [];
      arr.push(line);
      linesByPo.set(line.purchaseOrderId, arr);
    }

    let purchaseOrdersProcessed = 0;
    let productsCreated = 0;
    let productsMatched = 0;
    let transitCreated = 0;

    for (const po of purchaseOrders) {
      const lines = linesByPo.get(po.id) || [];
      if (lines.length === 0) continue;
      if (poIdsWithTransit.has(po.id)) continue; // already synced

      const result = await syncInventoryFromPurchaseOrder({
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        poLines: lines,
        user_id: po.user_id,
      });

      purchaseOrdersProcessed += 1;
      productsCreated += result.productsCreated;
      productsMatched += result.productsMatched;
      transitCreated += result.transitCreated;
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseOrdersProcessed,
        productsCreated,
        productsMatched,
        transitCreated,
      },
    });
  } catch (error) {
    console.error('Inventory backfill error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill inventory from purchase orders' },
      { status: 500 }
    );
  }
}
