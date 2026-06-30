import { supabase } from '../lib/supabase';

/**
 * Uploads a generated PDF receipt to Supabase Storage bucket.
 * @param {Blob} pdfBlob - The PDF file blob.
 * @param {string} billId - The ID of the bill/invoice.
 * @returns {Promise<object>} Public URL of the receipt.
 */
export const uploadPDFReceipt = async (pdfBlob, billId) => {
  const { data: { user } } = await supabase.auth.getUser();
  const filePath = `${user?.id || 'public'}/Receipt-${billId}-${Date.now()}.pdf`;
  
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(filePath, pdfBlob, {
      cacheControl: '3600',
      upsert: true
    });
    
  if (error) {
    console.error('Supabase Storage Error in uploadPDFReceipt:', error);
    throw error;
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);
    
  return { fileUrl: publicUrl };
};
