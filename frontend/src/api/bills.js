import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const getBills = async (filters = {}) => {
  try {
    const res = await api.get('/bills', { params: filters });
    return { data: { data: res.data.data } };
  } catch (err) {
    let query = supabase.from('bills').select('*, items:bill_items(*)');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.customer) query = query.eq('customer_id', filters.customer);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { data: { data } };
  }
}

export const getBill = async (id) => {
  try {
    const res = await api.get(`/bills/${id}`);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*, items:bill_items(*)')
      .eq('id', id)
      .single();
    if (billError) throw billError;
    const { data: payments } = await supabase.from('payments').select('*').eq('bill_id', id);
    return { data: { data: { ...bill, payments } } };
  }
}

export const createBill = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const billPayload = {
    id: data.id,
    customer_id: data.customer_id,
    date: data.date,
    due_date: data.due_date || null,
    subtotal: Number(data.subtotal || 0),
    discount_type: data.discount_type || 'flat',
    discount_value: Number(data.discount_value || 0),
    gst_percent: Number(data.gst_percent || 0),
    gst_amount: Number(data.gst_amount || 0),
    total: Number(data.total || 0),
    amount_paid: Number(data.amount_paid || 0),
    balance: Number(data.balance || 0),
    status: data.status || 'unpaid',
    notes: data.notes || '',
    items: (data.items || []).map(item => ({
      item_name: item.item_name,
      print_type: item.print_type || 'color',
      sides: item.sides || 'single',
      qty: Number(item.qty || 1),
      unit_price: Number(item.unit_price || 0),
      amount: Number(item.amount || (Number(item.qty || 1) * Number(item.unit_price || 0)))
    }))
  };

  try {
    const res = await api.post('/bills', billPayload);
    return { data: { data: res.data.data } };
  } catch (err) {
    // Fallback to direct Supabase upsert if local backend endpoint offline
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .upsert([{ ...billPayload, user_id: user?.id }])
      .select()
      .single();
    if (billError) throw billError;
    if (billPayload.items && billPayload.items.length > 0) {
      const itemsData = billPayload.items.map(item => ({ ...item, user_id: user?.id, bill_id: data.id }));
      await supabase.from('bill_items').insert(itemsData);
    }
    return { data: { data: bill } };
  }
}

export const updateBill = async (id, data) => {
  try {
    const res = await api.put(`/bills/${id}`, data);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (billError) throw billError;
    return { data: { data: bill } };
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
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('bills')
      .select('*, items:bill_items(*)')
      .not('deleted_at', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: { data } };
  }
}

export const applyDiscount = async (id, discountData) => {
  try {
    const res = await api.post(`/bills/${id}/discount`, discountData);
    return { data: { data: res.data.data } };
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
    return { data: { data: updated } };
  }
}
