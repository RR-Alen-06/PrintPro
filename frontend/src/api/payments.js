import { supabase, logSupabaseError } from '../lib/supabase'

export const getBillPayments = async (billId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('bill_id', billId)
    .order('date', { ascending: true });
  if (error) {
    logSupabaseError('payments', 'SELECT_BILL_PAYMENTS', { bill_id: billId }, error);
    throw error;
  }
  return { data: { data } };
}

export const createPayment = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const paymentData = {
    user_id: user?.id,
    bill_id: data.bill_id,
    customer_id: data.customer_id,
    cash_amount: data.cash_amount || 0,
    upi_amount: data.upi_amount || 0,
    total_paid: data.total_paid || 0,
    payment_type: data.payment_type || 'partial',
    notes: data.notes || ''
  };
  
  const { data: inserted, error } = await supabase
    .from('payments')
    .upsert([paymentData])
    .select()
    .single();
    
  if (error) {
    logSupabaseError('payments', 'UPSERT', paymentData, error);
    throw error;
  }
  return { data: { data: inserted } };
}

export const getCustomerPayments = async (customerId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('date', { ascending: false });
  if (error) {
    logSupabaseError('payments', 'SELECT_CUSTOMER_PAYMENTS', { customer_id: customerId }, error);
    throw error;
  }
  return { data: { data } };
}

export const getPayments = async () => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('date', { ascending: false });
  if (error) {
    logSupabaseError('payments', 'SELECT_ALL', {}, error);
    throw error;
  }
  return { data: { data } };
}

export const deletePayment = async (id) => {
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);
  if (error) {
    logSupabaseError('payments', 'DELETE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}
