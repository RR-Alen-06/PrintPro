import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const mapItemFromApi = (i: any) => ({
  ...i,
  id: i.id,
  name: i.name || '',
  type: i.type || 'print',
  hsnCode: i.hsn_code || i.hsnCode || '',
  sellingPrice: Number(i.selling_price !== undefined ? i.selling_price : (i.sellingPrice || 0)),
  colorSingle: Number(i.color_single !== undefined ? i.color_single : (i.colorSingle || 0)),
  colorDouble: Number(i.color_double !== undefined ? i.color_double : (i.colorDouble || 0)),
  bwSingle: Number(i.bw_single !== undefined ? i.bw_single : (i.bwSingle || 0)),
  bwDouble: Number(i.bw_double !== undefined ? i.bw_double : (i.bwDouble || 0)),
  stock: Number(i.stock || 0),
  lowStockAlert: Number(i.low_stock_alert !== undefined ? i.low_stock_alert : (i.lowStockAlert || 5))
});

export const getItems = async () => {
  try {
    const res = await api.get('/inventory');
    const mapped = (res.data.data || []).map(mapItemFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(mapItemFromApi);
    return { data: { data: mapped } };
  }
}

export const createItem = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    name: data.name,
    type: data.type || 'print',
    hsn_code: data.hsn_code || data.hsnCode || null,
    selling_price: Number(data.selling_price !== undefined ? data.selling_price : (data.sellingPrice || 0)),
    color_single: Number(data.color_single !== undefined ? data.color_single : (data.colorSingle || 0)),
    color_double: Number(data.color_double !== undefined ? data.color_double : (data.colorDouble || 0)),
    bw_single: Number(data.bw_single !== undefined ? data.bw_single : (data.bwSingle || 0)),
    bw_double: Number(data.bw_double !== undefined ? data.bw_double : (data.bwDouble || 0)),
    stock: Number(data.stock || 0),
    low_stock_alert: Number(data.low_stock_alert !== undefined ? data.low_stock_alert : (data.lowStockAlert || 50))
  };

  try {
    const res = await api.post('/inventory', payload);
    return { data: { data: mapItemFromApi(res.data.data) } };
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
    return { data: { data: mapItemFromApi(inserted) } };
  }
}

export const updateItem = async (id, data) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.type !== undefined) payload.type = data.type;
  if (data.hsn_code !== undefined || data.hsnCode !== undefined) {
    payload.hsn_code = data.hsn_code || data.hsnCode || null;
  }
  if (data.selling_price !== undefined || data.sellingPrice !== undefined) {
    payload.selling_price = Number(data.selling_price !== undefined ? data.selling_price : data.sellingPrice);
  }
  if (data.color_single !== undefined || data.colorSingle !== undefined) {
    payload.color_single = Number(data.color_single !== undefined ? data.color_single : data.colorSingle);
  }
  if (data.color_double !== undefined || data.colorDouble !== undefined) {
    payload.color_double = Number(data.color_double !== undefined ? data.color_double : data.colorDouble);
  }
  if (data.bw_single !== undefined || data.bwSingle !== undefined) {
    payload.bw_single = Number(data.bw_single !== undefined ? data.bw_single : data.bwSingle);
  }
  if (data.bw_double !== undefined || data.bwDouble !== undefined) {
    payload.bw_double = Number(data.bw_double !== undefined ? data.bw_double : data.bwDouble);
  }
  if (data.stock !== undefined) payload.stock = Number(data.stock);
  if (data.low_stock_alert !== undefined || data.lowStockAlert !== undefined) {
    payload.low_stock_alert = Number(data.low_stock_alert !== undefined ? data.low_stock_alert : data.lowStockAlert);
  }

  try {
    const res = await api.put(`/inventory/${id}`, payload);
    return { data: { data: mapItemFromApi(res.data.data) } };
  } catch (err) {
    const { data: updated, error } = await supabase
      .from('inventory_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: { data: mapItemFromApi(updated) } };
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


