-- Add user_id to all main tables for multi-tenant support
-- Each user represents one company

-- Add user_id to suppliers table (nullable to allow existing data)
ALTER TABLE suppliers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to products table (nullable to allow existing data)  
ALTER TABLE products ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to purchaseorders table (nullable to allow existing data)
ALTER TABLE purchaseorders ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to inventory table (nullable to allow existing data)
ALTER TABLE inventory ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to transit table (nullable to allow existing data)
ALTER TABLE transit ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to invoices table (nullable to allow existing data)
ALTER TABLE invoices ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to tasks table (nullable to allow existing data)
ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_purchaseorders_user_id ON purchaseorders(user_id);
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_transit_user_id ON transit(user_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchaseorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE polines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to isolate data by user
-- Suppliers policies
CREATE POLICY "Users can only see their own suppliers" ON suppliers
    FOR ALL USING (auth.uid() = user_id);

-- Products policies  
CREATE POLICY "Users can only see their own products" ON products
    FOR ALL USING (auth.uid() = user_id);

-- Purchase orders policies
CREATE POLICY "Users can only see their own purchase orders" ON purchaseorders
    FOR ALL USING (auth.uid() = user_id);

-- Inventory policies
CREATE POLICY "Users can only see their own inventory" ON inventory
    FOR ALL USING (auth.uid() = user_id);

-- Transit policies
CREATE POLICY "Users can only see their own transit records" ON transit
    FOR ALL USING (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can only see their own invoices" ON invoices
    FOR ALL USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can only see their own tasks" ON tasks
    FOR ALL USING (auth.uid() = user_id);

-- PO Lines policies (linked through purchase orders)
CREATE POLICY "Users can only see their own po lines" ON polines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM purchaseorders 
            WHERE purchaseorders.id = polines.purchaseorderid 
            AND purchaseorders.user_id = auth.uid()
        )
    );

-- Add user profile table for additional user data
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can only see their own profile" ON profiles
    FOR ALL USING (auth.uid() = id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Comments for documentation
COMMENT ON COLUMN suppliers.user_id IS 'Links supplier to the authenticated user (company)';
COMMENT ON COLUMN products.user_id IS 'Links product to the authenticated user (company)';
COMMENT ON COLUMN purchaseorders.user_id IS 'Links purchase order to the authenticated user (company)';
COMMENT ON COLUMN inventory.user_id IS 'Links inventory to the authenticated user (company)';
COMMENT ON COLUMN transit.user_id IS 'Links transit record to the authenticated user (company)';
COMMENT ON COLUMN invoices.user_id IS 'Links invoice to the authenticated user (company)';
COMMENT ON COLUMN tasks.user_id IS 'Links task to the authenticated user (company)';
