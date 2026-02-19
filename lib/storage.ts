import { serverSupabase as supabase } from './supabase-server';

const BUCKET_NAME = 'po-invoices';

export async function uploadInvoiceImage(file: File, purchaseOrderId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${purchaseOrderId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

export async function uploadInvoiceImages(files: File[], purchaseOrderId: string): Promise<string[]> {
  const uploadPromises = files.map(file => uploadInvoiceImage(file, purchaseOrderId));
  return Promise.all(uploadPromises);
}

export async function deleteInvoiceImages(imageUrls: string[]): Promise<void> {
  const filePaths = imageUrls.map(url => {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`${BUCKET_NAME}/`);
    return pathParts[1];
  }).filter(Boolean);

  if (filePaths.length === 0) return;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filePaths);

  if (error) {
    console.error('Failed to delete images:', error);
  }
}
