import { supabase, logSupabaseError } from '../lib/supabase'

export const getCustomers = async (type = 'all', search = '') => {
  let query = supabase.from('customers').select('*');
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  if (error) {
    logSupabaseError('customers', 'SELECT_ALL', { type, search }, error);
    throw error;
  }
  return { data: { data } };
}

export const getCustomer = async (id) => {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (error) {
    logSupabaseError('customers', 'SELECT_ONE', { id }, error);
    throw error;
  }
  
  // Bills summary
  const { data: billsSummary, error: billsError } = await supabase
    .from('bills')
    .select('total, amount_paid, balance, status')
    .eq('customer_id', id)
    .is('deleted_at', null);
    
  if (billsError) {
    logSupabaseError('bills', 'SELECT_SUMMARY', { customer_id: id }, billsError);
    throw billsError;
  }
  
  const summary = {
    total_bills: billsSummary.length,
    total_billed: billsSummary.reduce((s, b) => s + parseFloat(b.total || 0), 0),
    total_paid: billsSummary.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0),
    total_outstanding: billsSummary.reduce((s, b) => s + parseFloat(b.balance || 0), 0),
    unpaid_count: billsSummary.filter(b => b.status === 'unpaid').length,
    partial_count: billsSummary.filter(b => b.status === 'partial').length,
    paid_count: billsSummary.filter(b => b.status === 'paid').length
  };
  
  return { data: { data: { ...data, bills_summary: summary } } };
}

export const createCustomer = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const insertData = {
    id: data.id,
    user_id: user?.id,
    type: data.type,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    credit_balance: data.credit_balance || 0,
    credit_limit: data.credit_limit || 0
  };
  
  const { data: inserted, error } = await supabase.from('customers').insert([insertData]).select().single();
  if (error) {
    logSupabaseError('customers', 'INSERT', insertData, error);
    throw error;
  }
  return { data: { data: inserted } };
}

export const updateCustomer = async (id, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.credit_balance !== undefined) updateData.credit_balance = data.credit_balance;
  if (data.credit_limit !== undefined) updateData.credit_limit = data.credit_limit;
  const { data: updated, error } = await supabase.from('customers').update(updateData).eq('id', id).select().single();
  if (error) {
    logSupabaseError('customers', 'UPDATE', { id, updateData }, error);
    throw error;
  }
  return { data: { data: updated } };
}

export const deleteCustomer = async (id) => {
  const { data, error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    logSupabaseError('customers', 'DELETE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}

export const getCustomerBills = async (id) => {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('customer_id', id)
    .is('deleted_at', null)
    .order('date', { ascending: false });
  if (error) {
    logSupabaseError('bills', 'SELECT_CUSTOMER_BILLS', { customer_id: id }, error);
    throw error;
  }
  return { data: { data } };
}

export const getCustomerPayments = async (id) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', id)
    .order('date', { ascending: false });
  if (error) {
    logSupabaseError('payments', 'SELECT_CUSTOMER_PAYMENTS', { customer_id: id }, error);
    throw error;
  }
  return { data: { data } };
}

export const getCustomerStatement = async (id) => {
  const [billsRes, paymentsRes] = await Promise.all([
    getCustomerBills(id),
    getCustomerPayments(id)
  ]);
  const bills = billsRes.data.data.map(b => ({ ...b, entry_type: 'bill' }));
  const payments = paymentsRes.data.data.map(p => ({ ...p, entry_type: 'payment' }));
  const combined = [...bills, ...payments].sort((a, b) => b.date.localeCompare(a.date));
  return { data: { data: combined } };
}
