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
    qty: data.qty || 1,
    unit_cost: data.unit_cost || 0,
    total: data.total || 0,
    notes: data.notes || ''
  };
  
  const { data: inserted, error } = await supabase
    .from('purchases')
    .upsert([insertData])
    .select()
    .single();
    
  if (error) {
    logSupabaseError('purchases', 'UPSERT', insertData, error);
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
  return getPurchases();
}
