export type ShopifyWebhookTopic = 'orders/create' | 'orders/cancelled' | 'refunds/create';

export type ShopifyOrderLineItem = {
  id: number;
  variant_id: number | null;
  sku: string | null;
  quantity: number;
};

export type ShopifyOrdersCreatePayload = {
  id: number;
  line_items: ShopifyOrderLineItem[];
};

export type ShopifyOrdersCancelledPayload = ShopifyOrdersCreatePayload;

export type ShopifyRefundLineItem = {
  quantity: number;
  line_item: ShopifyOrderLineItem;
};

export type ShopifyRefundsCreatePayload = {
  id: number;
  order_id: number;
  refund_line_items: ShopifyRefundLineItem[];
};
