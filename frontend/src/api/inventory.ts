import api, { isBackendAvailable, markBackendUnavailable } from './index'
import { supabase, logSupabaseError } from '../lib/supabase'
import { SequenceService } from '../services/sequenceService'

export const mapItemFromApi = (i: any) => {
  if (!i) return i;
  const parseNum = (val: any, fallback = 0) => {
    if (val === null || val === undefined || val === '') return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };

  const itemCode = i.item_code || i.itemCode || SequenceService.formatDisplayCode('inventory', i.id, 'ITM');
  const unitPrice = parseNum(i.unit_price !== undefined ? i.unit_price : (i.unitPrice !== undefined ? i.unitPrice : (i.price !== undefined ? i.price : i.selling_price)), 0);
  const sellingPrice = parseNum(i.selling_price !== undefined ? i.selling_price : (i.sellingPrice !== undefined ? i.sellingPrice : unitPrice), 0);
  const colorSingle = parseNum(i.color_single !== undefined ? i.color_single : i.colorSingle, 0);
  const colorDouble = parseNum(i.color_double !== undefined ? i.color_double : i.colorDouble, 0);
  const bwSingle = parseNum(i.bw_single !== undefined ? i.bw_single : i.bwSingle, 0);
  const bwDouble = parseNum(i.bw_double !== undefined ? i.bw_double : i.bwDouble, 0);
  const stock = parseNum(i.stock, 0);
  const lowStockAlert = parseNum(i.low_stock_alert !== undefined ? i.low_stock_alert : i.lowStockAlert, 0);

  return {
    ...i,
    id: i.id,
    itemCode,
    item_code: itemCode,
    name: i.name || '',
    type: i.type || 'product',
    category: i.category || '',
    sku: i.sku || '',
    attributes: i.attributes || {},
    pricingTiers: i.pricing_tiers || i.pricingTiers || [],
    pricing_tiers: i.pricing_tiers || i.pricingTiers || [],
    unitPrice,
    unit_price: unitPrice,
    price: unitPrice,
    hsnCode: i.hsn_code || i.hsnCode || '',
    hsn_code: i.hsn_code || i.hsnCode || '',
    sellingPrice,
    selling_price: sellingPrice,
    colorSingle,
    color_single: colorSingle,
    colorDouble,
    color_double: colorDouble,
    bwSingle,
    bw_single: bwSingle,
    bwDouble,
    bw_double: bwDouble,
    stock,
    lowStockAlert,
    low_stock_alert: lowStockAlert,
  };
};

export const getItems = async () => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/inventory');
      const mapped = (res.data.data || []).map(mapItemFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  const mapped = (data || []).map(mapItemFromApi);
  return { data: { data: mapped } };
}

export const createItem = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const unitPrice = Number(data.unit_price !== undefined ? data.unit_price : (data.unitPrice !== undefined ? data.unitPrice : (data.price !== undefined ? data.price : (data.selling_price || 0)))) || 0;
  const payload: any = {
    name: data.name,
    type: data.type || 'product',
    category: data.category || '',
    sku: data.sku || '',
    unit_price: unitPrice,
    hsn_code: data.hsn_code || data.hsnCode || null,
    selling_price: unitPrice,
    color_single: Number(data.color_single !== undefined ? data.color_single : (data.colorSingle || 0)),
    color_double: Number(data.color_double !== undefined ? data.color_double : (data.colorDouble || 0)),
    bw_single: Number(data.bw_single !== undefined ? data.bw_single : (data.bwSingle || 0)),
    bw_double: Number(data.bw_double !== undefined ? data.bw_double : (data.bwDouble || 0)),
    stock: Number(data.stock !== undefined ? data.stock : 0),
    low_stock_alert: Number(data.low_stock_alert !== undefined ? data.low_stock_alert : (data.lowStockAlert || 0)),
    attributes: data.attributes || {},
    pricing_tiers: data.pricing_tiers || data.pricingTiers || [],
  };

  if (isBackendAvailable()) {
    try {
      const res = await api.post('/inventory', payload);
      return { data: { data: mapItemFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data: inserted, error } = await supabase
    .from('inventory_items')
    .upsert([{ ...payload, user_id: user?.id }])
    .select()
    .single();
  if (error) throw error;
  return { data: { data: mapItemFromApi(inserted) } };
}

export const updateItem = async (id, data) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.type !== undefined) payload.type = data.type;
  if (data.category !== undefined) payload.category = data.category;
  if (data.sku !== undefined) payload.sku = data.sku;
  if (data.unit_price !== undefined || data.unitPrice !== undefined || data.price !== undefined) {
    const p = Number(data.unit_price !== undefined ? data.unit_price : (data.unitPrice !== undefined ? data.unitPrice : data.price));
    payload.unit_price = isNaN(p) ? 0 : p;
    payload.selling_price = payload.unit_price;
  }
  if (data.hsn_code !== undefined || data.hsnCode !== undefined) {
    payload.hsn_code = data.hsn_code || data.hsnCode || null;
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
  if (data.stock !== undefined) {
    payload.stock = Number(data.stock);
  }
  if (data.low_stock_alert !== undefined || data.lowStockAlert !== undefined) {
    payload.low_stock_alert = Number(data.low_stock_alert !== undefined ? data.low_stock_alert : data.lowStockAlert);
  }
  if (data.attributes !== undefined) {
    payload.attributes = data.attributes;
  }
  if (data.pricing_tiers !== undefined || data.pricingTiers !== undefined) {
    payload.pricing_tiers = data.pricing_tiers || data.pricingTiers;
  }

  if (isBackendAvailable()) {
    try {
      const res = await api.put(`/inventory/${id}`, payload);
      return { data: { data: mapItemFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data: updated, error } = await supabase
    .from('inventory_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { data: { data: mapItemFromApi(updated) } };
}

export const deleteItem = async (id) => {
  if (isBackendAvailable()) {
    try {
      await api.delete(`/inventory/${id}`);
      return { data: { success: true } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
  return { data: { success: true } };
}

export const adjustStock = async (id: string | number, delta: number) => {
  const quantity = Number(delta || 0);

  if (isBackendAvailable()) {
    try {
      const res = await api.patch(`/inventory/${id}/stock`, { quantity, delta: quantity });
      return { data: { data: mapItemFromApi(res.data?.data || res.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  // Supabase fallback:
  const { data: currentItem, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const currentStock = Number(currentItem?.stock || 0);
  const newStock = Math.max(0, currentStock + quantity);

  const { data: updated, error: updateErr } = await supabase
    .from('inventory_items')
    .update({ stock: newStock })
    .eq('id', id)
    .select()
    .single();
  if (updateErr) throw updateErr;

  return { data: { data: mapItemFromApi(updated) } };
};

export const getLowStock = async () => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/inventory/low-stock');
      return { data: { data: res.data?.data || [] } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data, error } = await supabase.from('inventory_items').select('*');
  if (error) throw error;
  const filtered = (data || []).filter(i => Number(i.stock || 0) <= Number(i.low_stock_alert !== undefined ? i.low_stock_alert : 50));
  return { data: { data: filtered.map(mapItemFromApi) } };
}



