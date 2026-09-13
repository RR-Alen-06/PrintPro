import api, { isBackendAvailable, markBackendUnavailable } from './index'
import { supabase, logSupabaseError } from '../lib/supabase'
import { isValidUUID } from '../lib/uuid'
import { SequenceService } from '../services/sequenceService'

export const mapPaymentFromApi = (p: any) => {
  if (!p) return p;
  const paymentCode = p.payment_code || p.paymentCode || p.code || SequenceService.formatDisplayCode('payment', p.id, 'PAY');
  const invoiceNumber = p.invoice_number || p.invoiceNumber || p.bill_invoice_number || p.billInvoiceNumber || (p.bill_id || p.billId ? SequenceService.formatDisplayCode('bill', p.bill_id || p.billId, 'INV') : '');
  const customerCode = p.customer_code || p.customerCode || (p.customer_id || p.customerId ? SequenceService.formatDisplayCode('customer', p.customer_id || p.customerId, 'CUS') : '');

  return {
    ...p,
    id: p.id,
    paymentCode,
    billId: p.bill_id || p.billId,
    invoiceNumber,
    customerId: p.customer_id || p.customerId,
    customerCode,
    customerName: p.customer_name || p.customerName || 'Customer',
    date: p.date || new Date().toISOString(),
    cashAmount: Number(p.cash_amount !== undefined ? p.cash_amount : (p.cashAmount || 0)),
    upiAmount: Number(p.upi_amount !== undefined ? p.upi_amount : (p.upiAmount || 0)),
    totalPaid: Number(p.total_paid !== undefined ? p.total_paid : (p.totalPaid || 0)),
    paymentType: p.payment_type || p.paymentType || 'partial',
    notes: p.notes || ''
  };
};

export const getBillPayments = async (billId: string) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get(`/bills/${billId}/payments`);
      const mapped = (res.data.data || []).map(mapPaymentFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  // Direct Supabase fallback:
  let resolvedBillId = billId;
  if (!isValidUUID(billId)) {
    // If not a UUID, check if billId is an invoice number
    const { data: bill } = await supabase
      .from('bills')
      .select('id')
      .eq('invoice_number', billId)
      .maybeSingle();
    if (bill?.id) {
      resolvedBillId = bill.id;
    } else {
      return { data: { data: [] } };
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('bill_id', resolvedBillId)
    .order('date', { ascending: true });
  if (error) throw error;
  const mapped = (data || []).map(mapPaymentFromApi);
  return { data: { data: mapped } };
}

export const createPayment = async (data: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const rawBillId = data.bill_id || data.billId;
  const rawCustomerId = data.customer_id || data.customerId;

  const payload: any = {
    cash_amount: Number(data.cash_amount !== undefined ? data.cash_amount : (data.cashAmount || 0)),
    upi_amount: Number(data.upi_amount !== undefined ? data.upi_amount : (data.upiAmount || 0)),
    total_paid: Number(data.total_paid !== undefined ? data.total_paid : (data.totalPaid || 0)),
    payment_type: data.payment_type || data.paymentType || 'partial',
    notes: data.notes || ''
  };

  if (isBackendAvailable()) {
    try {
      const res = await api.post('/payments', {
        ...payload,
        bill_id: rawBillId,
        customer_id: rawCustomerId
      });
      return { data: { data: mapPaymentFromApi(res.data.data) } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  // Supabase fallback resolution for bill_id
  if (rawBillId) {
    if (isValidUUID(rawBillId)) {
      payload.bill_id = rawBillId;
    } else {
      const { data: bill } = await supabase
        .from('bills')
        .select('id')
        .eq('invoice_number', rawBillId)
        .maybeSingle();
      if (bill?.id) {
        payload.bill_id = bill.id;
      }
    }
  }

  // Supabase fallback resolution for customer_id
  if (rawCustomerId) {
    if (isValidUUID(rawCustomerId)) {
      payload.customer_id = rawCustomerId;
    } else {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', rawCustomerId)
        .maybeSingle();
      if (cust?.id) {
        payload.customer_id = cust.id;
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from('payments')
    .upsert([{ ...payload, user_id: user?.id }])
    .select()
    .single();
  if (error) throw error;
  return { data: { data: mapPaymentFromApi(inserted) } };
}

export const getCustomerPayments = async (customerId: string) => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get(`/customers/${customerId}/payments`);
      const mapped = (res.data.data || []).map(mapPaymentFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }

  let resolvedCustomerId = customerId;
  if (!isValidUUID(customerId)) {
    const { data: cust } = await supabase
      .from('customers')
      .select('id')
      .eq('customer_code', customerId)
      .maybeSingle();
    if (cust?.id) {
      resolvedCustomerId = cust.id;
    } else {
      return { data: { data: [] } };
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', resolvedCustomerId)
    .order('date', { ascending: false });
  if (error) throw error;
  const mapped = (data || []).map(mapPaymentFromApi);
  return { data: { data: mapped } };
}

export const getPayments = async () => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/payments');
      const mapped = (res.data.data || []).map(mapPaymentFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  const mapped = (data || []).map(mapPaymentFromApi);
  return { data: { data: mapped } };
}

export const getDeletedPayments = async () => {
  if (isBackendAvailable()) {
    try {
      const res = await api.get('/payments/deleted');
      const mapped = (res.data?.data || res.data || []).map(mapPaymentFromApi);
      return { data: { data: mapped } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .or('payment_type.eq.refund,total_paid.lt.0')
      .order('date', { ascending: false });

    if (error) {
      // Fallback query without filter if schema differs
      const { data: allData, error: allErr } = await supabase
        .from('payments')
        .select('*')
        .order('date', { ascending: false });
      if (allErr) return { data: { data: [] } };
      const filtered = (allData || []).filter(
        (p: any) => p.payment_type === 'refund' || Number(p.total_paid || p.amount || 0) < 0 || p.is_refund === true || (p.notes && p.notes.toLowerCase().includes('refund'))
      );
      const mapped = filtered.map(mapPaymentFromApi);
      return { data: { data: mapped } };
    }

    const mapped = (data || []).map(mapPaymentFromApi);
    return { data: { data: mapped } };
  } catch {
    return { data: { data: [] } };
  }
}

export const deletePayment = async (id: string) => {
  if (isBackendAvailable()) {
    try {
      await api.delete(`/payments/${id}`);
      return { data: { success: true } };
    } catch (err: any) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      markBackendUnavailable();
    }
  }
  if (!isValidUUID(id)) {
    return { data: { success: true } };
  }
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) throw error;
  return { data: { success: true } };
}



