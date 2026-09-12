import { supabase } from '../lib/supabase';
import { SequenceConfig } from '../types/billing';

export type SequenceKey = 'BILL' | 'INV' | 'PAY' | 'CUS' | 'EXP' | 'ITM' | 'GRP' | 'RET' | 'CN' | string;

export class SequenceService {
  private static readonly DEFAULT_PREFIXES: Record<string, string> = {
    BILL: 'INV',
    INV: 'INV',
    PAY: 'PAY',
    CUS: 'CUS',
    EXP: 'EXP',
    ITM: 'ITM',
    ITEM: 'ITM',
    GRP: 'GRP',
    RET: 'RET',
    CN: 'CN',
  };

  /**
   * Generates the next sequential ID atomically for a given entity key.
   * Calls get_next_sequence RPC in Supabase with user isolation, with fallback to table query.
   */
  static async getNextSequence(key: SequenceKey): Promise<string> {
    const uppercaseKey = key.toUpperCase();
    try {
      const { data, error } = await supabase.rpc('get_next_sequence', { p_key: uppercaseKey });
      if (!error && data) {
        return data;
      }
      return await this.fallbackSequence(uppercaseKey);
    } catch {
      return await this.fallbackSequence(uppercaseKey);
    }
  }

  /**
   * Formats a sequential number code given prefix, numeric value, and padding width.
   */
  static formatSequenceCode(prefix: string, value: number | string, padding: number = 6): string {
    const cleanPrefix = (prefix || 'SEQ').toUpperCase();
    const cleanPadding = Math.min(12, Math.max(2, padding || 6));
    const num = typeof value === 'number' ? value : parseInt(String(value).replace(/\D/g, ''), 10);
    const cleanValue = isNaN(num) || num <= 0 ? 1 : Math.floor(num);
    return `${cleanPrefix}-${String(cleanValue).padStart(cleanPadding, '0')}`;
  }

  /**
   * Universal display code resolver. Ensures that no raw UUID or messy ID is displayed to users.
   */
  static formatDisplayCode(
    entityType: 'bill' | 'customer' | 'inventory' | 'payment' | 'expense' | 'group' | 'creditNote' | string,
    itemOrId: any,
    fallbackPrefix?: string,
    padding: number = 6
  ): string {
    if (!itemOrId && itemOrId !== 0) return '—';

    // 1. Check if item has a designated code property
    if (typeof itemOrId === 'object') {
      const code =
        itemOrId.invoiceNumber ||
        itemOrId.customerCode ||
        itemOrId.itemCode ||
        itemOrId.paymentCode ||
        itemOrId.expenseCode ||
        itemOrId.creditNoteNumber ||
        itemOrId.groupInvoiceNumber ||
        itemOrId.code;

      if (code && typeof code === 'string' && code.trim()) {
        const trimmedCode = code.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedCode)) {
          return trimmedCode;
        }
      }
    }

    const rawVal = typeof itemOrId === 'object' ? (itemOrId.id || '') : String(itemOrId);
    const trimmed = String(rawVal).trim();

    // 2. If it's already a clean legacy/custom short code (e.g. RC0002, INV-000001, CUS-000042)
    if (trimmed && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      if (/^[A-Za-z]{1,6}[-_]?\d{1,10}$/.test(trimmed)) {
        return trimmed;
      }
    }

    // Determine prefix
    const typeUpper = (entityType || '').toUpperCase();
    const prefix = (
      fallbackPrefix ||
      this.DEFAULT_PREFIXES[typeUpper] ||
      (typeUpper === 'BILL' || typeUpper === 'INVOICE' ? 'INV' :
       typeUpper === 'CUSTOMER' ? 'CUS' :
       typeUpper === 'INVENTORY' || typeUpper === 'ITEM' ? 'ITM' :
       typeUpper === 'PAYMENT' ? 'PAY' :
       typeUpper === 'EXPENSE' ? 'EXP' :
       typeUpper === 'GROUP' ? 'GRP' :
       typeUpper === 'CREDITNOTE' || typeUpper === 'RETURN' ? 'CN' :
       typeUpper.slice(0, 3))
    ).toUpperCase();

    // 3. If it's a numeric ID (e.g. 1, 42, "123")
    if (/^\d+$/.test(trimmed)) {
      return this.formatSequenceCode(prefix, parseInt(trimmed, 10), padding);
    }

    // 4. If it's a UUID (e.g. "a3b84df1-...") or long alphanumeric string
    // Deterministically hash to a clean numeric sequence index for stable, readable display
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const positiveNum = Math.abs(hash) % 1000000 || 1;
    return this.formatSequenceCode(prefix, positiveNum, padding);
  }

  /**
   * Peeks at what the upcoming sequence code will be without incrementing the database counter.
   * Scans existing items to ensure the upcoming number is strictly higher than any existing record.
   */
  static peekNextSequence(
    entityType: 'bill' | 'customer' | 'inventory' | 'payment' | 'expense' | 'group' | 'creditNote' | string,
    existingItems: any[] = [],
    customPrefix?: string,
    padding: number = 6
  ): string {
    const typeUpper = (entityType || '').toUpperCase();
    const prefix = (
      customPrefix ||
      this.DEFAULT_PREFIXES[typeUpper] ||
      (typeUpper === 'BILL' || typeUpper === 'INVOICE' ? 'INV' :
       typeUpper === 'CUSTOMER' ? 'CUS' :
       typeUpper === 'INVENTORY' || typeUpper === 'ITEM' ? 'ITM' :
       typeUpper === 'PAYMENT' ? 'PAY' :
       typeUpper === 'EXPENSE' ? 'EXP' :
       typeUpper === 'GROUP' ? 'GRP' :
       typeUpper === 'CREDITNOTE' || typeUpper === 'RETURN' ? 'CN' :
       typeUpper.slice(0, 3))
    ).toUpperCase();

    let maxNum = 0;
    const prefixPattern = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');

    for (const item of existingItems) {
      if (!item) continue;
      const code =
        item.invoiceNumber ||
        item.invoice_number ||
        item.customerCode ||
        item.customer_code ||
        item.itemCode ||
        item.item_code ||
        item.paymentCode ||
        item.payment_code ||
        item.expenseCode ||
        item.expense_code ||
        item.groupInvoiceNumber ||
        item.creditNoteNumber ||
        item.code ||
        (typeof item.id === 'string' && !item.id.includes('-') ? item.id : '');

      if (code && typeof code === 'string') {
        const match = code.trim().match(prefixPattern);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
    }

    const nextVal = maxNum + 1;
    return this.formatSequenceCode(prefix, nextVal, padding);
  }

  /**
   * Collision-safe next sequence generator. Combines cloud RPC with local memory max check.
   */
  static async getNextSequenceSafe(
    key: SequenceKey,
    existingItems: any[] = [],
    customPrefix?: string,
    padding: number = 6
  ): Promise<string> {
    const uppercaseKey = key.toUpperCase();
    const prefix = (customPrefix || this.DEFAULT_PREFIXES[uppercaseKey] || uppercaseKey.slice(0, 3)).toUpperCase();

    let rpcCode = '';
    try {
      rpcCode = await this.getNextSequence(uppercaseKey);
    } catch {
      rpcCode = '';
    }

    const peeked = this.peekNextSequence(uppercaseKey, existingItems, prefix, padding);
    if (!rpcCode) return peeked;

    // Compare RPC number with local peeked number and take highest to prevent collisions
    const rpcMatch = rpcCode.match(/(\d+)$/);
    const peekMatch = peeked.match(/(\d+)$/);
    const rpcNum = rpcMatch ? parseInt(rpcMatch[1], 10) : 0;
    const peekNum = peekMatch ? parseInt(peekMatch[1], 10) : 0;

    const highestNum = Math.max(rpcNum, peekNum);
    return this.formatSequenceCode(prefix, highestNum, padding);
  }

  private static async fallbackSequence(key: string): Promise<string> {
    try {
      const { data: seq } = await supabase
        .from('sequences')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      const defaultPrefix = this.DEFAULT_PREFIXES[key] || key.slice(0, 3).toUpperCase();
      const prefix = seq?.prefix || defaultPrefix;
      const padding = seq?.padding || 6;
      const nextVal = (seq?.current_val || 0) + 1;

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('sequences').upsert({
        user_id: user?.id || null,
        key,
        prefix,
        padding,
        current_val: nextVal,
        updated_at: new Date().toISOString(),
      });

      return this.formatSequenceCode(prefix, nextVal, padding);
    } catch {
      // Local graceful fallback if offline/disconnected
      const prefix = this.DEFAULT_PREFIXES[key] || key.slice(0, 3).toUpperCase();
      const fallbackNum = Date.now().toString().slice(-6);
      return `${prefix}-${fallbackNum}`;
    }
  }

  static async getSequences(): Promise<SequenceConfig[]> {
    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .order('key', { ascending: true });

    if (error) return [];
    return data || [];
  }

  static async updateSequenceConfig(key: SequenceKey, prefix: string, padding: number, currentVal?: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const uppercaseKey = key.toUpperCase();
    const payload: any = {
      user_id: user?.id || null,
      key: uppercaseKey,
      prefix: prefix.toUpperCase(),
      padding: Math.min(12, Math.max(2, padding)),
      updated_at: new Date().toISOString(),
    };
    if (currentVal !== undefined && !isNaN(Number(currentVal))) {
      payload.current_val = Math.max(0, Number(currentVal));
    }

    const { error } = await supabase.from('sequences').upsert(payload);
    if (error) throw new Error(error.message);
  }
}
