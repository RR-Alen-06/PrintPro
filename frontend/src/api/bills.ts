import api, { isBackendAvailable, markBackendUnavailable } from './index'
import { supabase } from '../lib/supabase'
import { isValidUUID } from '../lib/uuid'
import { SequenceService } from '../services/sequenceService'

export interface BillFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  customer?: string;
}

export const mapBillFromApi = (b: any) => {
  if (!b) return b;
  const invoiceNumber = b.invoice_number || b.invoiceNumber || b.bill_number || SequenceService.formatDisplayCode('bill', b.id, 'INV');
  return {
    ...b,
    id: b.id,
    invoiceNumber,
    customerId: b.customer_id || b.customerId,
    customerName: b.customer_name || b.customerName || 'Walk-in Customer',
  date: b.date ? new Date(b.date).toISOString().slice(0, 10) : b.date,
  dueDate: b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : (b.dueDate || null),
  subtotal: Number(b.subtotal || 0),
  discountType: b.discount_type || b.discountType || 'flat',
  discountValue: Number(b.discount_value !== undefined ? b.discount_value : (b.discountValue || 0)),
  gstPercent: Number(b.gst_percent !== undefined ? b.gst_percent : (b.gstPercent || 0)),
  gstAmount: Number(b.gst_amount !== undefined ? b.gst_amount : (b.gstAmount || 0)),
  total: Number(b.total || 0),
  amountPaid: Number(b.amount_paid !== undefined ? b.amount_paid : (b.amountPaid || 0)),
  balance: Number(b.balance !== undefined ? b.balance : (b.balance || 0)),
  status: b.status || 'unpaid',
  deleted: !!b.deleted_at,
  items: (b.items || []).map((item: any) => ({
    ...item,
    itemId: item.item_id || item.itemId || item.id,
    name: item.item_name || item.itemName || item.name,
    printType: item.print_type || item.printType,
    sides: item.sides,
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0)),
    amount: Number(item.amount || 0),
  }))
  };
};

export const getBills = async (filters: BillFilters = {}) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/bills', { params: filters });
      const mapped = (res.data.data || []).map(mapBillFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  let query: any = supabase.from('bills').select('*, items:bill_items(*)');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);
  if (filters.customer) query = query.eq('customer_id', filters.customer);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  const mapped = (data || []).map(mapBillFromApi);
  return { data: { data: mapped } };
}

export const getBill = async (id: string) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get(`/bills/${id}`);
      return { data: { data: mapBillFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  // Supabase fallback:
  let billQuery = supabase.from('bills').select('*, items:bill_items(*)');
  if (isValidUUID(id)) {
    billQuery = billQuery.eq('id', id);
  } else {
    billQuery = billQuery.eq('invoice_number', id);
  }

  const { data: bill, error: billError } = await billQuery.maybeSingle();
  if (billError) throw billError;
  if (!bill) throw new Error(`Bill not found for identifier ${id}`);

  const { data: payments } = await supabase.from('payments').select('*').eq('bill_id', bill.id);
  return { data: { data: { ...mapBillFromApi(bill), payments } } };
}

export const createBill = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const billPayload: any = {
    customer_id: data.customer_id || data.customerId,
    invoice_number: data.invoice_number || data.invoiceNumber || undefined,
    date: data.date || new Date().toISOString().slice(0, 10),
    due_date: data.due_date || data.dueDate || null,
    subtotal: Number(data.subtotal || 0),
    discount_type: data.discount_type || data.discountType || 'flat',
    discount_value: Number(data.discount_value !== undefined ? data.discount_value : (data.discountValue || 0)),
    gst_percent: Number(data.gst_percent !== undefined ? data.gst_percent : (data.gstPercent || 0)),
    gst_amount: Number(data.gst_amount !== undefined ? data.gst_amount : (data.gstAmount || 0)),
    total: Number(data.total || 0),
    amount_paid: Number(data.amount_paid !== undefined ? data.amount_paid : (data.amountPaid || 0)),
    balance: Number(data.balance !== undefined ? data.balance : (data.balance || 0)),
    status: data.status || 'unpaid',
    notes: data.notes || '',
    cash_amount: Number(data.cash_amount !== undefined ? data.cash_amount : (data.cashAmount || 0)),
    upi_amount: Number(data.upi_amount !== undefined ? data.upi_amount : (data.upiAmount || 0)),
    advance_used: Number(data.advance_used !== undefined ? data.advance_used : (data.advanceUsed || 0)),
    return_change_upi: Number(data.return_change_upi !== undefined ? data.return_change_upi : (data.returnChangeUpi || 0)),
    items: (data.items || []).map((item: any) => {
      const uPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0));
      const q = Number(item.qty || 1);
      return {
        item_id: item.item_id || item.itemId || null,
        item_name: item.item_name || item.itemName || item.name || 'Print Item',
        print_type: item.print_type || item.printType || 'color',
        sides: item.sides || 'single',
        qty: q,
        unit_price: uPrice,
        amount: Number(item.amount !== undefined ? item.amount : (q * uPrice))
      };
    })
  };

  // Only attach ID if it is a valid UUID
  if (data.id && isValidUUID(data.id)) {
    billPayload.id = data.id;
  }

  if (isBackendAvailable()) {
    try {
      const res = await api.post('/bills', billPayload);
      return { data: { data: mapBillFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err; // Re-throw 4xx client/validation errors directly to UI
      }
      markBackendUnavailable();
    }
  }

  // Fallback to direct Supabase upsert only for network/5xx offline errors
  const { items, cash_amount, upi_amount, advance_used, return_change_upi, ...billScalarData } = billPayload;

  // Resolve customer_id if not a UUID
  if (billScalarData.customer_id && !isValidUUID(billScalarData.customer_id)) {
    const { data: cust } = await supabase
      .from('customers')
      .select('id, credit_balance')
      .eq('customer_code', billScalarData.customer_id)
      .maybeSingle();
    if (cust?.id) {
      billScalarData.customer_id = cust.id;
    } else {
      delete billScalarData.customer_id;
    }
  }

  // If billScalarData.id is not a valid UUID, remove it so Supabase generates UUID
  if (billScalarData.id && !isValidUUID(billScalarData.id)) {
    delete billScalarData.id;
  }

  const { data: bill, error: billError } = await supabase
    .from('bills')
    .upsert([{ ...billScalarData, user_id: user?.id }])
    .select()
    .single();
  if (billError) throw billError;

  if (items && items.length > 0) {
    const itemsData = items.map((item: any) => {
      const sanitizedItem: any = {
        item_name: item.item_name,
        print_type: item.print_type,
        sides: item.sides,
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.amount,
        user_id: user?.id,
        bill_id: bill.id // CRITICAL: Use Supabase returned bill.id UUID
      };
      if (item.item_id && isValidUUID(item.item_id)) {
        sanitizedItem.item_id = item.item_id;
      }
      return sanitizedItem;
    });
    await supabase.from('bill_items').insert(itemsData);
  }

  // Record atomic upfront payment in Supabase if cash/upi provided
  const directPaid = Number(cash_amount || 0) + Number(upi_amount || 0);
  if (directPaid > 0) {
    await supabase.from('payments').insert([{
      bill_id: bill.id,
      customer_id: bill.customer_id,
      cash_amount: Number(cash_amount || 0),
      upi_amount: Number(upi_amount || 0),
      total_paid: directPaid,
      payment_type: bill.balance <= 0 ? 'full' : 'partial',
      notes: 'Upfront bill payment',
      user_id: user?.id
    }]);
  }

  // Record advance payment deduction in Supabase if advance used
  const advUsed = Number(advance_used || 0);
  if (advUsed > 0 && bill.customer_id) {
    await supabase.from('payments').insert([{
      bill_id: bill.id,
      customer_id: bill.customer_id,
      cash_amount: 0,
      upi_amount: 0,
      total_paid: advUsed,
      payment_type: bill.balance <= 0 ? 'full' : 'partial',
      notes: 'Advance Balance applied',
      user_id: user?.id
    }]);

    // Deduct from customer credit balance
    const { data: custData } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', bill.customer_id)
      .maybeSingle();
    if (custData) {
      const currentCredit = Number(custData.credit_balance || 0);
      await supabase
        .from('customers')
        .update({ credit_balance: Math.max(0, currentCredit - advUsed) })
        .eq('id', bill.customer_id);
    }
  }

  return { data: { data: mapBillFromApi(bill) } };
}

export const updateBill = async (id: string, data: any) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.put(`/bills/${id}`, data);
      return { data: { data: mapBillFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  let billId = id;
  if (!isValidUUID(id)) {
    const { data: found } = await supabase
      .from('bills')
      .select('id')
      .eq('invoice_number', id)
      .maybeSingle();
    if (found?.id) billId = found.id;
  }

  const { data: bill, error: billError } = await supabase
    .from('bills')
    .update(data)
    .eq('id', billId)
    .select()
    .single();
  if (billError) throw billError;
  return { data: { data: mapBillFromApi(bill) } };
}

export const deleteBill = async (id: string) => {
  if (isBackendAvailable()) {
    try {
      await api.delete(`/bills/${id}`);
      return { data: { success: true } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  let billId = id;
  if (!isValidUUID(id)) {
    const { data: found } = await supabase
      .from('bills')
      .select('id')
      .eq('invoice_number', id)
      .maybeSingle();
    if (found?.id) billId = found.id;
  }

  const { error } = await supabase
    .from('bills')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', billId);
  if (error) throw error;
  return { data: { success: true } };
}

export const restoreBill = async (id: string) => {
  if (isBackendAvailable()) {
    try {
      await api.post(`/bills/${id}/restore`);
      return { data: { success: true } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { error } = await supabase
    .from('bills')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
  return { data: { success: true } };
}

export const getDeletedBills = async () => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/bills/deleted/all');
      const mapped = (res.data.data || []).map(mapBillFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data, error } = await supabase
    .from('bills')
    .select('*, items:bill_items(*)')
    .not('deleted_at', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const mapped = (data || []).map(mapBillFromApi);
  return { data: { data: mapped } };
}

export const applyDiscount = async (id, discountData) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.post(`/bills/${id}/discount`, discountData);
      return { data: { data: mapBillFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data: updated, error } = await supabase
    .from('bills')
    .update({
      discount_type: discountData.discount_type,
      discount_value: discountData.discount_value,
      total: discountData.total,
      balance: discountData.balance,
      status: discountData.status
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { data: { data: mapBillFromApi(updated) } };
}

