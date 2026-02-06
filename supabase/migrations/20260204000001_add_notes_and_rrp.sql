-- Add notes field to purchaseorders table
-- This allows notes to be added at the import order level
ALTER TABLE purchaseorders ADD COLUMN notes TEXT;

-- Add RRP (Recommended Retail Price) field to polines table
-- This allows RRP to be specified per line item
ALTER TABLE polines ADD COLUMN rrp NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN purchaseorders.notes IS 'Notes for the purchase order, visible in the purchase orders view for staff instructions';
COMMENT ON COLUMN polines.rrp IS 'Recommended Retail Price for the line item, can be detected by AI or manually entered';
