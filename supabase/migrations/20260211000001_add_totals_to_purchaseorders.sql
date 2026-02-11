-- Add totals columns to purchaseorders table
-- These store the invoice-level totals (subtotal, extras, VAT, total) separately from line item sums
ALTER TABLE purchaseorders
  ADD COLUMN IF NOT EXISTS subtotalexvat NUMERIC,
  ADD COLUMN IF NOT EXISTS extras NUMERIC,
  ADD COLUMN IF NOT EXISTS vat NUMERIC,
  ADD COLUMN IF NOT EXISTS totalamount NUMERIC;
