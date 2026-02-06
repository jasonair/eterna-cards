import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { user, supabase } = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabase
    .from('shopify_orders')
    .select(`
      id,
      shopify_order_id,
      order_number,
      channel,
      status,
      financial_status,
      fulfillment_status,
      customer_email,
      customer_name,
      total_price,
      currency,
      line_items,
      processed_at,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data: orders, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orderIds = orders?.map(o => o.id) || [];

  let inventoryEffects: Record<string, Array<{ product_id: string; quantity_change: number; product_name?: string }>> = {};

  if (orderIds.length > 0) {
    const { data: effects } = await supabase
      .from('order_inventory_effects')
      .select(`
        order_id,
        product_id,
        quantity_change,
        products (name)
      `)
      .in('order_id', orderIds);

    if (effects) {
      for (const e of effects) {
        if (!inventoryEffects[e.order_id]) {
          inventoryEffects[e.order_id] = [];
        }
        inventoryEffects[e.order_id].push({
          product_id: e.product_id,
          quantity_change: e.quantity_change,
          product_name: (e.products as any)?.name,
        });
      }
    }
  }

  const enrichedOrders = orders?.map(order => ({
    ...order,
    inventory_effects: inventoryEffects[order.id] || [],
  }));

  return NextResponse.json({
    orders: enrichedOrders,
    total: count,
  });
}
