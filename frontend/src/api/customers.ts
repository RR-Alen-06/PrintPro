import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'
import { mapBillFromApi } from './bills'

export const mapCustomerFromApi = (c: any) => ({
  ...c,
  id: c.id,
  customerCode: c.customer_code || c.customerCode || c.code || (typeof c.id === 'string' && !c.id.includes('-') ? c.id : undefined),
  type: c.type || 'regular',
  name: c.name || '',
  phone: c.phone || '',
  email: c.email || '',
  address: c.address || '',
  creditBalance: Number(c.credit_balance !== undefined ? c.credit_balance : (c.creditBalance || 0)),
  advanceBalance: Number(c.advance_balance !== undefined ? c.advance_balance : (c.advanceBalance || c.credit_balance || 0)),
  creditLimit: Number(c.credit_limit !== undefined ? c.credit_limit : (c.creditLimit || 0)),
  loyaltyPoints: Number(c.loyalty_points !== undefined ? c.loyalty_points : (c.loyaltyPoints || 0)),
  createdAt: c.created_at || c.createdAt || new Date().toISOString()
});

export const getCustomers = async (type = 'all', search = '') => {
  try {
    const res = await api.get('/customers', { params: { type, search } });
    const mapped = (res.data.data || []).map(mapCustomerFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    let query = supabase.from('customers').select('*');
    if (type && type !== 'all') query = query.eq('type', type);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    const mapped = (data || []).map(mapCustomerFromApi);
    return { data: { data: mapped } };
  }
}

export const getCustomer = async (id) => {
  try {
    const res = await api.get(`/customers/${id}`);
    return { data: { data: mapCustomerFromApi(res.data.data) } };
  } catch (err) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) throw error;
    return { data: { data: mapCustomerFromApi(data) } };
  }
}

export const createCustomer = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload: any = {
    type: data.type || 'regular',
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    credit_balance: Number(data.credit_balance || 0),
    credit_limit: Number(data.credit_limit || 0)
  };

  // Include id only if it is a valid UUID
  if (data.id && typeof data.id === 'string' && !data.id.startsWith('temp-')) {
    payload.id = data.id;
  }

  try {
    const res = await api.post('/customers', payload);
    return { data: { data: res.data.data } };
  } catch (err: any) {
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
    // Generate customer_code on direct Supabase fallback path
    let customerCode = data.customer_code || data.customerCode;
    if (!customerCode) {
      const prefix = (payload.type === 'regular' ? 'RC' : 'WC');
      const { data: maxRows } = await supabase
        .from('customers')
        .select('customer_code')
        .eq('user_id', user?.id)
        .like('customer_code', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (maxRows && maxRows.length > 0 && maxRows[0].customer_code) {
        const numPart = maxRows[0].customer_code.replace(/[^0-9]/g, '');
        nextNum = parseInt(numPart || '0', 10) + 1;
      }
      customerCode = `${prefix}${String(nextNum).padStart(4, '0')}`;
    }

    const { data: inserted, error } = await supabase
      .from('customers')
      .upsert([{ ...payload, customer_code: customerCode, user_id: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return { data: { data: mapCustomerFromApi(inserted) } };
  }
}

export const updateCustomer = async (id, data) => {
  try {
    const res = await api.put(`/customers/${id}`, data);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: updated, error } = await supabase
      .from('customers')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data: { data: updated } };
  }
}

export const deleteCustomer = async (id) => {
  try {
    await api.delete(`/customers/${id}`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}

export const getCustomerBills = async (id) => {
  try {
    const res = await api.get(`/customers/${id}/bills`);
    const mapped = (res.data.data || []).map(mapBillFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', id)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(mapBillFromApi);
    return { data: { data: mapped } };
  }
}

export const getCustomerPayments = async (id) => {
  try {
    const res = await api.get(`/customers/${id}/payments`);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', id)
      .order('date', { ascending: false });
    if (error) throw error;
    return { data: { data } };
  }
}

export const getCustomerStatement = async (id) => {
  const [billsRes, paymentsRes] = await Promise.all([
    getCustomerBills(id),
    getCustomerPayments(id)
  ]);
  const bills = (billsRes.data.data || []).map(b => ({ ...b, entry_type: 'bill' }));
  const payments = (paymentsRes.data.data || []).map(p => ({ ...p, entry_type: 'payment' }));
  const combined = [...bills, ...payments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { data: { data: combined } };
}
