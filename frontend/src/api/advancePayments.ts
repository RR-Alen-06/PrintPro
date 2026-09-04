import api from './index'
import { supabase } from '../lib/supabase'

export const mapAdvancePaymentFromApi = (a: any) => ({
  id: a.id,
  customerId: a.customerId || a.customer_id,
  customerName: a.customerName || a.customer_name || 'Customer',
  amount: Number(a.amount || 0),
  cashAmount: Number(a.cashAmount !== undefined ? a.cashAmount : (a.cash_amount || 0)),
  upiAmount: Number(a.upiAmount !== undefined ? a.upiAmount : (a.upi_amount || 0)),
  date: a.date || (a.createdAt ? a.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  notes: a.notes || '',
  isReturn: !!(a.isReturn || a.is_return),
  createdAt: a.createdAt || a.created_at || new Date().toISOString(),
})

export const getAdvancePayments = async () => {
  try {
    const res = await api.get('/advance-payments');
    const mapped = (res.data.data || []).map(mapAdvancePaymentFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: { data: [] } };
    const { data, error } = await supabase
      .from('business_profile')
      .select('advance_payments')
      .eq('user_id', user.id)
      .single();
    if (error) throw error;
    const advances = (data && data.advance_payments) || [];
    return { data: { data: advances.map(mapAdvancePaymentFromApi) } };
  }
}

export const createAdvancePayment = async (payload: any) => {
  try {
    const res = await api.post('/advance-payments', payload);
    return { data: { data: mapAdvancePaymentFromApi(res.data.data) } };
  } catch (err) {
    throw err;
  }
}

export const deleteAdvancePayment = async (id: string) => {
  try {
    const res = await api.delete(`/advance-payments/${id}`);
    return res.data;
  } catch (err) {
    throw err;
  }
}
