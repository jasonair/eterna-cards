import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getOrSetCache } from '@/lib/cache';

const CACHE_KEY = 'purchasing_po_view_v1';
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

// GET endpoint to retrieve all database data
export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const payload = await getOrSetCache(
      CACHE_KEY,
      CACHE_TTL_MS,
      async () => {
        // Fetch all related data from Supabase
        const [suppliersRaw, purchaseOrdersRaw, poLinesRaw, productsRaw, inventoryRaw, transitRaw, invoicesRaw] =
          await Promise.all([
            supabase
              .from('suppliers')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('purchaseorders')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('polines')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('products')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('inventory')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('transit')
              .select('*')
              .then(({ data }) => data || []),
            supabase
              .from('invoices')
              .select('*')
              .then(({ data }) => data || []),
          ]);

        // Map DB rows to the exact shapes the frontend expects (camelCase fields)
        const suppliers = suppliersRaw.map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          vatNumber: null,
          createdAt: s.created_at,
        }));

        const purchaseOrders = purchaseOrdersRaw.map((po: any) => ({
          id: po.id,
          supplierId: po.supplierid,
          invoiceNumber: po.invoicenumber ?? null,
          invoiceDate: po.invoicedate ?? null,
          currency: po.currency,
          paymentTerms: po.paymentterms ?? null,
          createdAt: po.created_at,
        }));

        const poLines = poLinesRaw.map((l: any) => ({
          id: l.id,
          purchaseOrderId: l.purchaseorderid,
          description: l.description,
          supplierSku: l.suppliersku ?? null,
          quantity: Number(l.quantity ?? 0),
          unitCostExVAT: Number(l.unitcostexvat ?? 0),
          lineTotalExVAT: Number(l.linetotalexvat ?? 0),
        }));

        const products = productsRaw.map((p: any) => ({
          id: p.id,
          name: p.name,
          primarySku: p.primarysku ?? null,
          supplierSku: p.suppliersku ?? null,
          barcodes: p.barcodes ?? [],
          aliases: p.aliases ?? [],
          supplierId: p.supplierid ?? null,
          category: p.category ?? null,
          tags: p.tags ?? [],
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));

        const inventory = inventoryRaw.map((inv: any) => ({
          id: inv.id,
          productId: inv.productid,
          quantityOnHand: Number(inv.quantityonhand ?? 0),
          averageCostGBP: Number(inv.averagecostgbp ?? 0),
          lastUpdated: inv.lastupdated,
        }));

        const transit = transitRaw.map((t: any) => ({
          id: t.id,
          productId: t.productid,
          purchaseOrderId: t.purchaseorderid,
          poLineId: t.polineid,
          supplierId: t.supplierid,
          quantity: Number(t.quantity ?? 0),
          remainingQuantity: Number(t.remainingquantity ?? 0),
          unitCostGBP: Number(t.unitcostgbp ?? 0),
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        }));

        const invoices = invoicesRaw.map((inv: any) => ({
          id: inv.id,
          purchaseOrderId: inv.purchaseorderid,
          supplierId: inv.supplierid,
          invoiceNumber: inv.invoicenumber ?? null,
          invoiceDate: inv.invoicedate ?? null,
          currency: inv.currency,
          createdAt: inv.created_at,
        }));

        return {
          suppliers,
          purchaseOrders,
          poLines,
          products,
          inventory,
          transit,
          invoices,
          tasks: [],
        };
      },
      forceRefresh,
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Database read error:', error);
    return NextResponse.json(
      { error: 'Failed to read database' },
      { status: 500 }
    );
  }
}
