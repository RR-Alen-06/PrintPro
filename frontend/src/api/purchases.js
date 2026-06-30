import { supabase, logSupabaseError } from '../lib/supabase'

export const getPurchases = async (filters = {}) => {
  let query = supabase.from('purchases').select('*');
  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  query = query.order('date', { ascending: false });
  const { data, error } = await query;
  if (error) {
    logSupabaseError('purchases', 'SELECT_ALL', filters, error);
    throw error;
  }
  return { data: { data } };
}

export const createPurchase = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const insertData = {
    user_id: user?.id,
    date: data.date,
    item_name: data.item_name,
    category: data.category,
    qty: data.qty || 0,
    unit_cost: data.unit_cost || 0,
    total: data.total || 0,
    notes: data.notes || ''
  };
  
  const { data: inserted, error } = await supabase
    .from('purchases')
    .insert([insertData])
    .select()
    .single();
  if (error) {
    logSupabaseError('purchases', 'INSERT', insertData, error);
    throw error;
  }
  return { data: { data: inserted } };
}

export const updatePurchase = async (id, data) => {
  const updateData = {
    date: data.date,
    item_name: data.item_name,
    category: data.category,
    qty: data.qty,
    unit_cost: data.unit_cost,
    total: data.total,
    notes: data.notes
  };
  const { data: updated, error } = await supabase
    .from('purchases')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError('purchases', 'UPDATE', { id, updateData }, error);
    throw error;
  }
  return { data: { data: updated } };
}

export const deletePurchase = async (id) => {
  const { data, error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', id);
  if (error) {
    logSupabaseError('purchases', 'DELETE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}

export const getPurchaseSummary = async () => {
  const { data, error } = await supabase
    .from('purchases')
    .select('category, total');
  if (error) {
    logSupabaseError('purchases', 'SELECT_SUMMARY', {}, error);
    throw error;
  }
  
  const summary = {};
  data.forEach(p => {
    summary[p.category] = (summary[p.category] || 0) + parseFloat(p.total || 0);
  });
  
  const mapped = Object.keys(summary).map(cat => ({
    category: cat,
    total_spent: summary[cat],
    count: data.filter(p => p.category === cat).length
  })).sort((a, b) => b.total_spent - a.total_spent);
  
  return { data: { data: mapped } };
}
