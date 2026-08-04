import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const getItems = async () => {
  try {
    const res = await api.get('/inventory');
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return { data: { data } };
  }
}

export const createItem = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    name: data.name,
    color_single: Number(data.color_single || 0),
    color_double: Number(data.color_double || 0),
    bw_single: Number(data.bw_single || 0),
    bw_double: Number(data.bw_double || 0),
    stock: Number(data.stock || 0),
    low_stock_alert: Number(data.low_stock_alert || 50)
  };

  try {
    const res = await api.post('/inventory', payload);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: inserted, error } = await supabase
      .from('inventory_items')
      .upsert([{ ...payload, user_id: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return { data: { data: inserted } };
  }
}

export const updateItem = async (id, data) => {
  try {
    const res = await api.put(`/inventory/${id}`, data);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: updated, error } = await supabase
      .from('inventory_items')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: { data: updated } };
  }
}

export const deleteItem = async (id) => {
  try {
    await api.delete(`/inventory/${id}`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}

export const getLowStock = async () => {
  try {
    const res = await api.get('/inventory/low-stock');
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase.from('inventory_items').select('*');
    if (error) throw error;
    const filtered = (data || []).filter(i => (i.stock || 0) <= (i.low_stock_alert || 50));
    return { data: { data: filtered } };
  }
}


