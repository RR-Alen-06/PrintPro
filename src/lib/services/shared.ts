import { supabase, isSupabaseConfigured } from '../supabase/client';
import {
  AllSettings,
  AuditLog,
  Bill,
  BillItem,
  DateFilterOption,
  Payment,
  RoundingMethod
} from '../types';

export const DEFAULT_SETTINGS: AllSettings = {
  shop: {
    shop_name: 'PrintPro Store',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    logo_url: '',
    footer_message: 'Thank you for your business!'
  },
  billing: {
    bill_prefix: 'BILL',
    bill_format: 'BILL-{SEQ}',
    default_payment_method: 'Cash',
    currency_symbol: '₹',
    decimal_precision: 2,
    gst_enabled: false,
    gst_rate: 0,
    default_printer_size: '80mm',
    auto_print: false,
    rounding_method: 'None'
  },
  loyalty: {
    enabled: true,
    calculation_mode: 'rate',
    earn_points: 1,
    earn_spend_unit: 10,
    points_required: 10,
    discount_value: 5
  },
  whatsapp: {
    enabled: true,
    template_text: '',
    enable_pdf_sharing: true,
    enable_text_sharing: true,
    email_service_id: '',
    email_template_id: '',
    email_public_key: ''
  },
  security: {
    super_admin_pin: '1234',
    session_timeout_minutes: 30,
    payment_reversal_window_hours: 72
  },
  app: {
    theme: 'light',
    date_format: 'DD/MM/YYYY',
    time_format: '12h'
  },
  expenses: {
    categories: [
      'Shop Expense',
      'Electricity',
      'Rent',
      'Paper Stock & Rolls',
      'Toner & Cartridges',
      'Machine Maintenance',
      'Staff Wages',
      'Other Expense'
    ],
    default_payment_mode: 'Cash'
  }
};

export const DEFAULT_SEQUENCES: Array<{ key: string; prefix: string; padding: number }> = [
  { key: 'AUDIT', prefix: 'AUD', padding: 6 },
  { key: 'BILL', prefix: 'INV', padding: 6 },
  { key: 'CLOSE', prefix: 'CLS', padding: 6 },
  { key: 'CUSTOMER', prefix: 'CUST', padding: 6 },
  { key: 'EXPENSE', prefix: 'EXP', padding: 6 },
  { key: 'GROUP_BILL', prefix: 'GRP', padding: 6 },
  { key: 'LOYALTY', prefix: 'LTX', padding: 6 },
  { key: 'PAYMENT', prefix: 'PAY', padding: 6 },
  { key: 'PRODUCT', prefix: 'PROD', padding: 6 },
  { key: 'TRANS', prefix: 'TRF', padding: 6 }
];

export function isActiveBill(b: { status?: string | null }): boolean {
  return b.status !== 'CANCELLED' && b.status !== 'VOID';
}

export function calculateRounding(subtotalAfterDiscount: number, method: RoundingMethod): {
  roundedTotal: number;
  roundingAdjustment: number;
} {
  let rounded = subtotalAfterDiscount;
  switch (method) {
    case 'Round Down':
      rounded = Math.floor(subtotalAfterDiscount);
      break;
    case 'Round Up':
      rounded = Math.ceil(subtotalAfterDiscount);
      break;
    case 'Standard':
      rounded = Math.round(subtotalAfterDiscount);
      break;
    case 'None':
    default:
      rounded = Number(subtotalAfterDiscount.toFixed(2));
      break;
  }
  const adjustment = Number((rounded - subtotalAfterDiscount).toFixed(2));
  return {
    roundedTotal: rounded,
    roundingAdjustment: adjustment
  };
}

export function getDateRangeBounds(filter: DateFilterOption, customRange?: { from: string; to: string }): {
  startDate?: Date;
  endDate?: Date;
} {
  const now = new Date();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  switch (filter) {
    case 'today':
      return { startDate, endDate };
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      return { startDate, endDate };
    case 'weekly':
      startDate.setDate(startDate.getDate() - 7);
      return { startDate, endDate };
    case 'monthly':
      startDate.setMonth(startDate.getMonth() - 1);
      return { startDate, endDate };
    case 'quarterly':
      startDate.setMonth(startDate.getMonth() - 3);
      return { startDate, endDate };
    case 'yearly':
      startDate.setFullYear(startDate.getFullYear() - 1);
      return { startDate, endDate };
    case 'financial_year': {
      const currentYear = now.getFullYear();
      const fyStart = now.getMonth() >= 3 ? new Date(currentYear, 3, 1) : new Date(currentYear - 1, 3, 1);
      return { startDate: fyStart, endDate };
    }
    case 'custom':
      if (customRange?.from && customRange?.to) {
        const fromDate = new Date(customRange.from);
        const toDate = new Date(customRange.to);
        if (!customRange.to.includes('T')) {
          toDate.setHours(23, 59, 59, 999);
        }
        return {
          startDate: fromDate,
          endDate: toDate
        };
      }
      return {};
    default:
      return {};
  }
}

export async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function fallbackSequence(key: string): Promise<string> {
  const normalizedKey = key.trim().toUpperCase();
  const userId = await getUserId();
  const defaultCfg = DEFAULT_SEQUENCES.find(d => d.key === normalizedKey);

  const { data: rows } = await supabase
    .from('sequences')
    .select('*')
    .ilike('key', normalizedKey);

  const seq = (rows || []).sort((a, b) => Number(b.current_val || 0) - Number(a.current_val || 0))[0];

  const prefix = seq?.prefix || defaultCfg?.prefix || normalizedKey.slice(0, 3);
  const padding = Number(seq?.padding || defaultCfg?.padding || 6);
  const currentCounter = Number(seq?.current_val || 0);
  const nextVal = currentCounter + 1;

  if (seq?.id) {
    await supabase
      .from('sequences')
      .update({
        key: normalizedKey,
        prefix,
        padding,
        current_val: nextVal,
        updated_at: new Date().toISOString()
      })
      .eq('id', seq.id);
  } else {
    await supabase.from('sequences').insert({
      key: normalizedKey,
      prefix,
      padding,
      current_val: nextVal,
      ...(userId ? { user_id: userId } : {}),
      updated_at: new Date().toISOString()
    });
  }

  return `${prefix}-${String(nextVal).padStart(padding, '0')}`;
}

export async function getNextSequence(key: string): Promise<string> {
  if (!isSupabaseConfigured) {
    const fallbackNum = Date.now().toString().slice(-6);
    return `${key.slice(0, 3).toUpperCase()}-${fallbackNum}`;
  }

  try {
    const { data, error } = await supabase.rpc('get_next_sequence', { p_key: key.toUpperCase() });
    if (error || !data) return await fallbackSequence(key);
    return data;
  } catch {
    return await fallbackSequence(key);
  }
}

export async function logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const userId = await getUserId();
    const auditNumber = await getNextSequence('AUDIT');
    await supabase.from('audit_logs').insert([{
      ...log,
      ...(userId ? { user_id: userId } : {}),
      audit_number: auditNumber
    }]);
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

export function formatBillRow(row: Record<string, unknown> | null | undefined): Bill {
  if (!row) return row as unknown as Bill;
  const custRaw = row.customers;
  const cust = Array.isArray(custRaw) ? custRaw[0] : (custRaw as Record<string, unknown> | undefined);
  const rawItems = (row.items || row.bill_items || []) as Array<Record<string, unknown>>;
  const formattedItems: BillItem[] = rawItems.map((it) => ({
    id: it.id as string | undefined,
    user_id: it.user_id as string | null | undefined,
    bill_id: it.bill_id as string | undefined,
    product_id: (it.product_id as string | null | undefined) ?? null,
    product_name: String((it.product_name && it.product_name !== 'Custom Item') ? it.product_name : (it.item_name || it.product_name || '')),
    price: Number(it.price ?? it.unit_price ?? 0),
    quantity: Number(it.quantity ?? it.qty ?? 0),
    total: Number(it.total ?? it.amount ?? 0),
    created_at: it.created_at as string | undefined
  }));

  const cash = Number(row.cash_paid || 0);
  const upi = Number(row.upi_paid || 0);
  const adv = Number(row.advance_used || 0);
  const paid = Number(row.paid_total || 0);

  let resolvedPaymentMethod = row.payment_method as string | undefined;
  if (!resolvedPaymentMethod || resolvedPaymentMethod === 'Cash' || resolvedPaymentMethod === 'Auto-Allocation') {
    if (upi > 0 && cash === 0) resolvedPaymentMethod = 'UPI';
    else if (cash > 0 && upi === 0) resolvedPaymentMethod = 'Cash';
    else if (cash > 0 && upi > 0) resolvedPaymentMethod = 'Split Payment';
    else if (adv > 0 && cash === 0 && upi === 0) resolvedPaymentMethod = 'Advance Used';
    else if (paid <= 0.01 && (!resolvedPaymentMethod || resolvedPaymentMethod === 'Cash' || resolvedPaymentMethod === 'Auto-Allocation')) resolvedPaymentMethod = 'Pay Later';
  }

  return {
    ...(row as unknown as Bill),
    customer_name: (row.customer_name as string | undefined) || (cust?.name as string | undefined) || ((row.customer_id as string | undefined) ? 'Customer' : 'Walk-in Customer'),
    customer_mobile: (row.customer_mobile as string | null | undefined) ?? (cust?.mobile as string | null | undefined) ?? null,
    customer_email: (row.customer_email as string | null | undefined) ?? (cust?.email as string | null | undefined) ?? null,
    advance_used: adv,
    paid_total: paid,
    cash_paid: cash,
    upi_paid: upi,
    payment_method: resolvedPaymentMethod || 'Cash',
    items: formattedItems
  };
}

export function formatPaymentRow(row: Record<string, unknown> | null | undefined): Payment {
  if (!row) return row as unknown as Payment;
  const custRaw = row.customers;
  const cust = Array.isArray(custRaw) ? custRaw[0] : (custRaw as Record<string, unknown> | undefined);
  const billRaw = row.bills;
  const bill = Array.isArray(billRaw) ? billRaw[0] : (billRaw as Record<string, unknown> | undefined);
  return {
    ...(row as unknown as Payment),
    payment_number: (row.payment_number as string | undefined) || 'PAY-N/A',
    customer_name: (row.customer_name as string | undefined) || (cust?.name as string | undefined) || ((row.customer_id as string | undefined) ? 'Customer' : 'Walk-in Customer'),
    customer_mobile: (row.customer_mobile as string | null | undefined) ?? (cust?.mobile as string | null | undefined) ?? null,
    bill_number: (row.bill_number as string | null | undefined) ?? (bill?.bill_number as string | null | undefined) ?? null,
    amount: Number(row.amount || 0)
  };
}

