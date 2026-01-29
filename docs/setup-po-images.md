# Purchase Order Image Storage Setup

This guide explains how to set up image storage for purchase order invoices.

## Supabase Storage Bucket Setup

1. **Create Storage Bucket**
   - Go to your Supabase project dashboard
   - Navigate to Storage
   - Click "Create a new bucket"
   - Bucket name: `po-invoices`
   - Make it **public** (so images can be displayed)
   - Click "Create bucket"

2. **Set Bucket Policies**
   - Go to the `po-invoices` bucket
   - Click on "Policies"
   - Add the following policies:

   **Policy 1: SELECT (read) - Public Access**
   - Policy name: `Public Access`
   - Allowed operation: Check `SELECT`
   - Policy definition:
   ```sql
   bucket_id = 'po-invoices'
   ```

   **Policy 2: INSERT (upload) - Authenticated users**
   - Policy name: `Authenticated users can upload`
   - Allowed operation: Check `INSERT`
   - Policy definition (WITH CHECK):
   ```sql
   bucket_id = 'po-invoices'
   ```
   Note: Since your backend uses service role keys, this simple policy is sufficient. Service role keys bypass RLS policies.

   **Policy 3: DELETE - Authenticated users**
   - Policy name: `Authenticated users can delete`
   - Allowed operation: Check `DELETE`
   - Policy definition (USING):
   ```sql
   bucket_id = 'po-invoices'
   ```

   Note: When using the Supabase UI, you only need to enter the condition part in the "Policy definition" field. The UI automatically wraps it with `USING ()` or `WITH CHECK ()`.

3. **Run Database Migration**
   Execute the migration file:
   ```bash
   # In your Supabase SQL Editor, run:
   supabase/migrations/20260120000000_add_po_images.sql
   ```

## How It Works

1. **Import Flow**
   - When you upload invoice images via `/purchasing/import`, the images are sent to the AI analyzer
   - After analysis and PO creation, images are uploaded to Supabase Storage
   - Image URLs are stored in the `purchaseorders` table (`imageurl` and `imageurls` columns)

2. **Viewing Images**
   - Go to `/purchasing/view` to see all purchase orders
   - Each PO card displays its original invoice images
   - Click on any image to view it full-size in a new tab

3. **Product Traceability**
   - Products created from PO lines are linked via the `transit` table
   - You can trace which invoice image a product came from by:
     - Finding the product's transit record
     - Looking up the associated purchase order
     - Viewing the PO's invoice images

## Image Storage Structure

Images are stored in Supabase Storage with the following path structure:
```
po-invoices/
  └── {purchase_order_id}/
      ├── {timestamp_1}.{ext}
      ├── {timestamp_2}.{ext}
      └── ...
```

## Notes

- Images are stored permanently until manually deleted
- Multi-page invoices are supported (multiple images per PO)
- Supported formats: PNG, JPG, JPEG, PDF (converted to images)
- The first image URL is also stored in `imageurl` for backwards compatibility
