import { supabase, logSupabaseError } from '../lib/supabase'

export const getItems = async () => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    logSupabaseError('inventory_items', 'SELECT_ALL', {}, error);
    throw error;
  }
  return { data: { data } };
}

export const createItem = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const insertData = {
    user_id: user?.id,
    name: data.name,
    color_single: data.color_single || 0,
    color_double: data.color_double || 0,
    bw_single: data.bw_single || 0,
    bw_double: data.bw_double || 0,
    stock: data.stock || 0,
    low_stock_alert: data.low_stock_alert || 50
  };
  const { data: inserted, error } = await supabase
    .from('inventory_items')
    .insert([insertData])
    .select()
    .single();
  if (error) {
    logSupabaseError('inventory_items', 'INSERT', insertData, error);
    throw error;
  }
  return { data: { data: inserted } };
}

export const updateItem = async (id, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color_single !== undefined) updateData.color_single = data.color_single;
  if (data.color_double !== undefined) updateData.color_double = data.color_double;
  if (data.bw_single !== undefined) updateData.bw_single = data.bw_single;
  if (data.bw_double !== undefined) updateData.bw_double = data.bw_double;
  if (data.stock !== undefined) updateData.stock = data.stock;
  if (data.low_stock_alert !== undefined) updateData.low_stock_alert = data.low_stock_alert;
  const { data: updated, error } = await supabase
    .from('inventory_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logSupabaseError('inventory_items', 'UPDATE', { id, updateData }, error);
    throw error;
  }
  return { data: { data: updated } };
}

export const deleteItem = async (id) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', id);
  if (error) {
    logSupabaseError('inventory_items', 'DELETE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}

export const getLowStock = async () => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*');
  if (error) {
    logSupabaseError('inventory_items', 'SELECT_LOW_STOCK', {}, error);
    throw error;
  }
  const filtered = data.filter(i => (i.stock || 0) <= (i.low_stock_alert || 50));
  return { data: { data: filtered } };
}
