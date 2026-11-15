/**
 * Shared helpers for WhatsApp URL generation and Web Share API PDF file sharing.
 */

export function buildWhatsAppUrl(text: string, mobile?: string | null): string {
  const encoded = encodeURIComponent(text);
  const digits = mobile ? mobile.replace(/[^0-9]/g, '') : '';
  if (!digits) {
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }
  const phone = digits.length === 10 ? `91${digits}` : digits;
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
}

export type PdfShareResult = 'shared' | 'unsupported' | 'cancelled';

export async function sharePdfWithWebShare(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<PdfShareResult> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return 'unsupported';
  }

  const file = new File([blob], filename, { type: 'application/pdf' });
  if (!navigator.canShare({ files: [file] })) {
    return 'unsupported';
  }

  try {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}
