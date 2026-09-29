import api from './index'

/**
 * Uploads a generated PDF blob to the backend.
 * @param pdfBlob - The PDF file blob.
 * @param billId - The ID of the bill/invoice.
 * @returns Response data containing fileUrl.
 */
export const uploadPDFReceipt = async (pdfBlob: Blob, billId: string): Promise<{ fileUrl: string }> => {
  const formData = new FormData()
  formData.append('pdf', pdfBlob, `Receipt-${billId}.pdf`)
  formData.append('billId', billId)

  const response = await api.post('/share/upload-pdf', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}
