import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const getPurchases = async (filters = {}) => {
  try {
    const res = await api.get('/purchases', { params: filters });
    return { data: { data: res.data.data } };
  } catch (err) {
    let query = supabase.from('purchases').select('*');
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.category) query = query.eq('category', filters.category);
    query = query.order('date', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { data: { data } };
  }
}

export const createPurchase = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    date: data.date,
    item_name: data.item_name,
    category: data.category,
    qty: Number(data.qty || 1),
    unit_cost: Number(data.unit_cost || 0),
    total: Number(data.total || 0),
    notes: data.notes || ''
  };

  try {
    const res = await api.post('/purchases', payload);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: inserted, error } = await supabase
      .from('purchases')
      .upsert([{ ...payload, user_id: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return { data: { data: inserted } };
  }
}

export const updatePurchase = async (id, data) => {
  try {
    const res = await api.put(`/purchases/${id}`, data);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: updated, error } = await supabase
      .from('purchases')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: { data: updated } };
  }
}

export const deletePurchase = async (id) => {
  try {
    await api.delete(`/purchases/${id}`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}

export const getPurchaseSummary = async () => {
  return getPurchases();
}
