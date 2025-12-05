-- Complete database schema with consistent lowercase column names
-- Run this in your Supabase SQL Editor to replace all tables

-- Drop all existing tables
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS transit CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS polines CASCADE;
DROP TABLE IF EXISTS purchaseorders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders table
CREATE TABLE purchaseorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplierid UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  invoicenumber TEXT,
  invoicedate TEXT,
  currency TEXT DEFAULT 'GBP',
  paymentterms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PO Lines table
CREATE TABLE polines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaseorderid UUID REFERENCES purchaseorders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  suppliersku TEXT,
  quantity NUMERIC NOT NULL,
  unitcostexvat NUMERIC NOT NULL,
  linetotalexvat NUMERIC NOT NULL
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  primarysku TEXT,
  suppliersku TEXT,
  barcodes TEXT[],
  aliases TEXT[],
  supplierid UUID REFERENCES suppliers(id),
  category TEXT,
  tags TEXT[],
  imageurl TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productid UUID REFERENCES products(id) ON DELETE CASCADE,
  quantityonhand NUMERIC NOT NULL DEFAULT 0,
  averagecostgbp NUMERIC NOT NULL DEFAULT 0,
  lastupdated TIMESTAMPTZ DEFAULT NOW()
);

-- Transit table
CREATE TABLE transit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productid UUID REFERENCES products(id) ON DELETE CASCADE,
  purchaseorderid UUID REFERENCES purchaseorders(id) ON DELETE CASCADE,
  polineid UUID REFERENCES polines(id) ON DELETE CASCADE,
  supplierid UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  remainingquantity NUMERIC NOT NULL,
  unitcostgbp NUMERIC NOT NULL,
  status TEXT DEFAULT 'in_transit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaseorderid UUID REFERENCES purchaseorders(id) ON DELETE CASCADE,
  supplierid UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  invoicenumber TEXT,
  invoicedate TEXT,
  currency TEXT DEFAULT 'GBP',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Create indexes for better performance
CREATE INDEX idx_purchaseorders_supplierid ON purchaseorders(supplierid);
CREATE INDEX idx_polines_purchaseorderid ON polines(purchaseorderid);
CREATE INDEX idx_products_supplierid ON products(supplierid);
CREATE INDEX idx_inventory_productid ON inventory(productid);
CREATE INDEX idx_transit_productid ON transit(productid);
CREATE INDEX idx_transit_purchaseorderid ON transit(purchaseorderid);
CREATE INDEX idx_invoices_purchaseorderid ON invoices(purchaseorderid);
CREATE INDEX idx_invoices_supplierid ON invoices(supplierid);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Disable Row Level Security for easier development
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchaseorders DISABLE ROW LEVEL SECURITY;
ALTER TABLE polines DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE transit DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
