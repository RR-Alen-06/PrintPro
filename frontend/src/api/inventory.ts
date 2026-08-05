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

export const createItem = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    name: data.name,
    color_single: Number(data.color_single !== undefined ? data.color_single : (data.colorSingle || 0)),
    color_double: Number(data.color_double !== undefined ? data.color_double : (data.colorDouble || 0)),
    bw_single: Number(data.bw_single !== undefined ? data.bw_single : (data.bwSingle || 0)),
    bw_double: Number(data.bw_double !== undefined ? data.bw_double : (data.bwDouble || 0)),
    stock: Number(data.stock || 0),
    low_stock_alert: Number(data.low_stock_alert !== undefined ? data.low_stock_alert : (data.lowStockAlert || 50))
  };

  try {
    const res = await api.post('/inventory', payload);
    return { data: { data: res.data.data } };
  } catch (err: any) {
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
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


