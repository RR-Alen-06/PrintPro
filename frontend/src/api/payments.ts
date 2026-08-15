import api from './index'
import { supabase, logSupabaseError } from '../lib/supabase'

export const mapPaymentFromApi = (p: any) => ({
  ...p,
  id: p.id,
  billId: p.bill_id || p.billId,
  invoiceNumber: p.invoice_number || p.invoiceNumber || p.bill_invoice_number || p.billInvoiceNumber,
  customerId: p.customer_id || p.customerId,
  customerCode: p.customer_code || p.customerCode,
  customerName: p.customer_name || p.customerName,
  date: p.date || new Date().toISOString(),
  cashAmount: Number(p.cash_amount !== undefined ? p.cash_amount : (p.cashAmount || 0)),
  upiAmount: Number(p.upi_amount !== undefined ? p.upi_amount : (p.upiAmount || 0)),
  totalPaid: Number(p.total_paid !== undefined ? p.total_paid : (p.totalPaid || 0)),
  paymentType: p.payment_type || p.paymentType || 'partial',
  notes: p.notes || ''
})

export const getBillPayments = async (billId) => {
  try {
    const res = await api.get(`/bills/${billId}/payments`);
    const mapped = (res.data.data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('bill_id', billId)
      .order('date', { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  }
}

export const createPayment = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    bill_id: data.bill_id || data.billId,
    customer_id: data.customer_id || data.customerId,
    cash_amount: Number(data.cash_amount !== undefined ? data.cash_amount : (data.cashAmount || 0)),
    upi_amount: Number(data.upi_amount !== undefined ? data.upi_amount : (data.upiAmount || 0)),
    total_paid: Number(data.total_paid !== undefined ? data.total_paid : (data.totalPaid || 0)),
    payment_type: data.payment_type || data.paymentType || 'partial',
    notes: data.notes || ''
  };

  try {
    const res = await api.post('/payments', payload);
    return { data: { data: mapPaymentFromApi(res.data.data) } };
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
    return { data: { data: mapPaymentFromApi(inserted) } };
  }
}

export const getCustomerPayments = async (customerId) => {
  try {
    const res = await api.get(`/customers/${customerId}/payments`);
    const mapped = (res.data.data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('date', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  }
}

export const getPayments = async () => {
  try {
    const res = await api.get('/payments');
    const mapped = (res.data.data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  } catch (err) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
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
