-- Add image storage fields to purchaseorders table
ALTER TABLE purchaseorders 
ADD COLUMN imageurl TEXT,
ADD COLUMN imageurls TEXT[];

-- Add comment for clarity
COMMENT ON COLUMN purchaseorders.imageurl IS 'Primary invoice image URL (for backwards compatibility)';
COMMENT ON COLUMN purchaseorders.imageurls IS 'Array of all invoice image URLs (for multi-page invoices)';