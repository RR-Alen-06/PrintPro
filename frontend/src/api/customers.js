import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const getCustomers = async (type = 'all', search = '') => {
  try {
    const res = await api.get('/customers', { params: { type, search } });
    return { data: { data: res.data.data } };
  } catch (err) {
    let query = supabase.from('customers').select('*');
    if (type && type !== 'all') query = query.eq('type', type);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { data: { data } };
  }
}

export const getCustomer = async (id) => {
  try {
    const res = await api.get(`/customers/${id}`);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) throw error;
    return { data: { data } };
  }
}

export const createCustomer = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    id: data.id,
    type: data.type || 'regular',
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    credit_balance: Number(data.credit_balance || 0),
    credit_limit: Number(data.credit_limit || 0)
  };

  try {
    const res = await api.post('/customers', payload);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data: inserted, error } = await supabase
      .from('customers')
      .upsert([{ ...payload, user_id: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return { data: { data: inserted } };
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
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', id)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    if (error) throw error;
    return { data: { data } };
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
