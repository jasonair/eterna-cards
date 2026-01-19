import type {
  ShopifyOrdersCancelledPayload,
  ShopifyOrdersCreatePayload,
  ShopifyRefundsCreatePayload,
} from './types';

export const exampleOrdersCreatePayload: ShopifyOrdersCreatePayload = {
  id: 820982911946154508,
  line_items: [
    {
      id: 866550311766439020,
      variant_id: 808950810,
      sku: 'SKU-EXAMPLE-1',
      quantity: 2,
    },
  ],
};

export const exampleOrdersCancelledPayload: ShopifyOrdersCancelledPayload = {
  id: 820982911946154508,
  line_items: [
    {
      id: 866550311766439020,
      variant_id: 808950810,
      sku: 'SKU-EXAMPLE-1',
      quantity: 2,
    },
  ],
};

export const exampleRefundsCreatePayload: ShopifyRefundsCreatePayload = {
  id: 509562969,
  order_id: 820982911946154508,
  refund_line_items: [
    {
      quantity: 1,
      line_item: {
        id: 866550311766439020,
        variant_id: 808950810,
        sku: 'SKU-EXAMPLE-1',
        quantity: 2,
      },
    },
  ],
};
