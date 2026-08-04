import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const getBillPayments = async (billId) => {
  try {
    const res = await api.get(`/bills/${billId}/payments`);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('bill_id', billId)
      .order('date', { ascending: true });
    if (error) throw error;
    return { data: { data } };
  }
}

export const createPayment = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    bill_id: data.bill_id,
    customer_id: data.customer_id,
    cash_amount: Number(data.cash_amount || 0),
    upi_amount: Number(data.upi_amount || 0),
    total_paid: Number(data.total_paid || 0),
    payment_type: data.payment_type || 'partial',
    notes: data.notes || ''
  };

  try {
    const res = await api.post('/payments', payload);
    return { data: { data: res.data.data } };
  } catch (err) {
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      throw err;
    }
    const { data: inserted, error } = await supabase
      .from('payments')
      .upsert([{ ...payload, user_id: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return { data: { data: inserted } };
  }
}

export const getCustomerPayments = async (customerId) => {
  try {
    const res = await api.get(`/customers/${customerId}/payments`);
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('date', { ascending: false });
    if (error) throw error;
    return { data: { data } };
  }
}

export const getPayments = async () => {
  try {
    const res = await api.get('/payments');
    return { data: { data: res.data.data } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return { data: { data } };
  }
}

export const deletePayment = async (id) => {
  try {
    await api.delete(`/payments/${id}`);
    return { data: { success: true } };
  } catch (err) {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    return { data: { success: true } };
  }
}
