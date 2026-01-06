import { NextRequest, NextResponse } from 'next/server';
import { getInventorySnapshot } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import { getOrSetCache } from '@/lib/cache';

const CACHE_KEY = 'inventory_snapshot_v1';
const CACHE_TTL_MS = 1000 * 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    const enriched = await getOrSetCache(
      CACHE_KEY,
      CACHE_TTL_MS,
      async () => {
        const snapshot = await getInventorySnapshot();

        // Get suppliers for enrichment
        const { data: suppliers } = await supabase.from('suppliers').select('*');

        const suppliersById = new Map(suppliers?.map((s) => [s.id, s]) ?? []);

        return snapshot.map((item) => ({
          product: item.product,
          inventory: item.inventory,
          quantityInTransit: item.quantityInTransit,
          supplier: item.product.supplierId ? suppliersById.get(item.product.supplierId) ?? null : null,
        }));
      },
      forceRefresh,
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Inventory snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to load inventory snapshot' },
      { status: 500 }
    );
  }
}
