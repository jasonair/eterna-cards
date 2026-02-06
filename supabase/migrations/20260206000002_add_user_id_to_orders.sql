-- Add user_id to shopify_orders for multi-tenant support
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shopify_orders_user_id ON shopify_orders(user_id);

-- Link existing orders to the first user
UPDATE shopify_orders SET user_id = 'a9193b1e-799e-4895-81e6-31e2d9273cf9' WHERE user_id IS NULL;

-- Enable RLS
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own orders" ON shopify_orders FOR ALL USING (auth.uid() = user_id);
