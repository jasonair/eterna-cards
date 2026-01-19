import type {
  ShopifyOrdersCancelledPayload,
  ShopifyOrdersCreatePayload,
  ShopifyRefundsCreatePayload,
  ShopifyWebhookTopic,
} from './types';

export type NormalizedInventoryEffect = {
  variantId: number | null;
  sku: string | null;
  quantity: number;
};

export type NormalizedWebhookWork = {
  topic: ShopifyWebhookTopic;
  orderId: string | null;
  effects: NormalizedInventoryEffect[];
};

export function normalizeShopifyWebhookWork(
  topic: ShopifyWebhookTopic,
  payload: unknown,
): NormalizedWebhookWork {
  if (topic === 'orders/create') {
    const p = payload as ShopifyOrdersCreatePayload;
    return {
      topic,
      orderId: typeof p?.id === 'number' ? String(p.id) : null,
      effects: (p?.line_items ?? []).map((li) => ({
        variantId: li?.variant_id ?? null,
        sku: li?.sku ?? null,
        quantity: Number(li?.quantity ?? 0),
      })),
    };
  }

  if (topic === 'orders/cancelled') {
    const p = payload as ShopifyOrdersCancelledPayload;
    return {
      topic,
      orderId: typeof p?.id === 'number' ? String(p.id) : null,
      effects: (p?.line_items ?? []).map((li) => ({
        variantId: li?.variant_id ?? null,
        sku: li?.sku ?? null,
        quantity: Number(li?.quantity ?? 0),
      })),
    };
  }

  const p = payload as ShopifyRefundsCreatePayload;
  return {
    topic,
    orderId: typeof p?.order_id === 'number' ? String(p.order_id) : null,
    effects: (p?.refund_line_items ?? []).map((rli) => ({
      variantId: rli?.line_item?.variant_id ?? null,
      sku: rli?.line_item?.sku ?? null,
      quantity: Number(rli?.quantity ?? 0),
    })),
  };
}

export function inventoryDeltaForTopic(topic: ShopifyWebhookTopic): number {
  if (topic === 'orders/create') return -1;
  return 1;
}
