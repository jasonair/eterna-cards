create table if not exists shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  order_number text,
  channel text not null default 'shopify',
  status text not null default 'pending',
  financial_status text,
  fulfillment_status text,
  customer_email text,
  customer_name text,
  total_price numeric(12,2),
  currency text default 'GBP',
  line_items jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shopify_orders_shopify_order_id on shopify_orders(shopify_order_id);
create index if not exists idx_shopify_orders_channel on shopify_orders(channel);
create index if not exists idx_shopify_orders_created_at on shopify_orders(created_at desc);

create table if not exists order_inventory_effects (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references shopify_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity_change numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_inventory_effects_order on order_inventory_effects(order_id);
create index if not exists idx_order_inventory_effects_product on order_inventory_effects(product_id);
