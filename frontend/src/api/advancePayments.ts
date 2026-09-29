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
      .maybeSingle();
    if (error && (error as any).code !== 'PGRST116') throw error;
    const advances = (data && data.advance_payments) || [];
    return { data: { data: advances.map(mapAdvancePaymentFromApi) } };
  }
}

export const createAdvancePayment = async (payload: any) => {
  try {
    const res = await api.post('/advance-payments', payload);
    return { data: { data: mapAdvancePaymentFromApi(res.data.data) } };
  } catch (err) {
    // Fallback directly to Supabase client
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw err;

    const numAmount = Number(payload.amount || 0);
    const newAdvance = {
      id: payload.id || `ADV-${Date.now()}`,
      customerId: payload.customerId || payload.customer_id || null,
      customerName: payload.customerName || payload.customer_name || 'Customer',
      amount: numAmount,
      cashAmount: Number(payload.cashAmount || 0),
      upiAmount: Number(payload.upiAmount || 0),
      date: payload.date || new Date().toISOString().slice(0, 10),
      notes: payload.notes || '',
      isReturn: !!payload.isReturn,
      createdAt: new Date().toISOString(),
    };

    const { data: profile } = await supabase
      .from('business_profile')
      .select('advance_payments')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentAdvances = (profile && profile.advance_payments) || [];
    const updatedAdvances = [newAdvance, ...currentAdvances];

    await supabase
      .from('business_profile')
      .upsert({ user_id: user.id, advance_payments: updatedAdvances }, { onConflict: 'user_id' });

    const custId = newAdvance.customerId;
    if (custId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('advance_balance, credit_balance')
        .eq('id', custId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cust) {
        const delta = newAdvance.isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);
        const curAdv = Number(cust.advance_balance || 0);
        const curCred = Number(cust.credit_balance || 0);
        await supabase
          .from('customers')
          .update({
            advance_balance: curAdv + delta,
            credit_balance: curCred + delta,
          })
          .eq('id', custId)
          .eq('user_id', user.id);
      }
    }

    return { data: { data: mapAdvancePaymentFromApi(newAdvance) } };
  }
}

export const deleteAdvancePayment = async (id: string) => {
  try {
    const res = await api.delete(`/advance-payments/${id}`);
    return res.data;
  } catch (err) {
    // Fallback directly to Supabase client
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw err;

    const { data: profile } = await supabase
      .from('business_profile')
      .select('advance_payments')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentAdvances = (profile && profile.advance_payments) || [];
    const target = currentAdvances.find((a: any) => a.id === id);
    const filteredAdvances = currentAdvances.filter((a: any) => a.id !== id);

    await supabase
      .from('business_profile')
      .update({ advance_payments: filteredAdvances })
      .eq('user_id', user.id);

    if (target) {
      const custId = target.customerId || target.customer_id;
      const numAmount = Number(target.amount || 0);
      const isReturn = !!(target.isReturn || target.is_return);
      const delta = isReturn ? -Math.abs(numAmount) : Math.abs(numAmount);

      if (custId) {
        const { data: cust } = await supabase
          .from('customers')
          .select('advance_balance, credit_balance')
          .eq('id', custId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (cust) {
          const curAdv = Number(cust.advance_balance || 0);
          const curCred = Number(cust.credit_balance || 0);
          await supabase
            .from('customers')
            .update({
              advance_balance: curAdv - delta,
              credit_balance: curCred - delta,
            })
            .eq('id', custId)
            .eq('user_id', user.id);
        }
      }
    }

    return { success: true, message: 'Advance payment removed' };
  }
}
