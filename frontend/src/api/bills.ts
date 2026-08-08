import api from './index'
import { supabase } from '../lib/supabase'

export interface BillFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  customer?: string;
}

export const mapBillFromApi = (b: any) => ({
  ...b,
  id: b.id,
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
    name: item.item_name || item.itemName || item.name,
    printType: item.print_type || item.printType,
    sides: item.sides,
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0)),
    amount: Number(item.amount || 0),
  }))
});

export const getBills = async (filters: BillFilters = {}) => {
  try {
    const res = await api.get('/bills', { params: filters });
    const mapped = (res.data.data || []).map(mapBillFromApi);
    return { data: { data: mapped } };
  } catch (err: any) {
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
}

export const getBill = async (id: string) => {
  try {
    const res = await api.get(`/bills/${id}`);
    return { data: { data: mapBillFromApi(res.data.data) } };
  } catch (err) {
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*, items:bill_items(*)')
      .eq('id', id)
      .single();
    if (billError) throw billError;
    const { data: payments } = await supabase.from('payments').select('*').eq('bill_id', id);
    return { data: { data: { ...mapBillFromApi(bill), payments } } };
  }
}

export const createBill = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const billPayload: any = {
    customer_id: data.customer_id || data.customerId,
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
    items: (data.items || []).map((item: any) => {
      const uPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0));
      const q = Number(item.qty || 1);
      return {
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
  if (data.id && typeof data.id === 'string' && !data.id.startsWith('temp-') && !data.id.startsWith('BILL-') && !data.id.startsWith('INV/')) {
    billPayload.id = data.id;
  }

  try {
    const res = await api.post('/bills', billPayload);
    return { data: { data: mapBillFromApi(res.data.data) } };
  } catch (err: any) {
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      throw err; // Re-throw 4xx client/validation errors directly to UI
    }
    // Fallback to direct Supabase upsert only for network/5xx offline errors
    const { items, ...billScalarData } = billPayload;
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .upsert([{ ...billScalarData, user_id: user?.id }])
      .select()
      .single();
    if (billError) throw billError;
    if (items && items.length > 0) {
      const itemsData = items.map(item => ({ ...item, user_id: user?.id, bill_id: data.id }));
      await supabase.from('bill_items').insert(itemsData);
    }
    return { data: { data: mapBillFromApi(bill) } };
  }
}

export const updateBill = async (id, data) => {
  try {
    const res = await api.put(`/bills/${id}`, data);
    return { data: { data: mapBillFromApi(res.data.data) } };
  } catch (err) {
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (billError) throw billError;
    return { data: { data: mapBillFromApi(bill) } };
  }
}

export const deleteBill = async (id) => {
  try {
    await api.delete(`/bills/${id}`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase
      .from('bills')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}

export const restoreBill = async (id) => {
  try {
    await api.post(`/bills/${id}/restore`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase
      .from('bills')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}

export const getDeletedBills = async () => {
  try {
    const res = await api.get('/bills/deleted/all');
    const mapped = (res.data.data || []).map(mapBillFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('bills')
      .select('*, items:bill_items(*)')
      .not('deleted_at', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(mapBillFromApi);
    return { data: { data: mapped } };
  }
}

export const applyDiscount = async (id, discountData) => {
  try {
    const res = await api.post(`/bills/${id}/discount`, discountData);
    return { data: { data: mapBillFromApi(res.data.data) } };
  } catch (err) {
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
}
