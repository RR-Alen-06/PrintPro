import { supabase, logSupabaseError } from '../lib/supabase'

export const getBills = async (filters = {}) => {
  let query = supabase.from('bills').select('*, items:bill_items(*)');
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }
  if (filters.customer) {
    query = query.eq('customer_id', filters.customer);
  }
  
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    logSupabaseError('bills', 'SELECT_ALL', filters, error);
    throw error;
  }
  return { data: { data } };
}

export const getBill = async (id) => {
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select('*, items:bill_items(*)')
    .eq('id', id)
    .single();
    
  if (billError) {
    logSupabaseError('bills', 'SELECT_ONE', { id }, billError);
    throw billError;
  }
  
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('bill_id', id)
    .order('date', { ascending: true });
    
  if (paymentsError) {
    logSupabaseError('payments', 'SELECT_BILL_PAYMENTS', { bill_id: id }, paymentsError);
    throw paymentsError;
  }
  
  return { data: { data: { ...bill, payments } } };
}

export const createBill = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const billData = {
    id: data.id,
    user_id: user?.id,
    customer_id: data.customer_id,
    date: data.date,
    due_date: data.due_date,
    subtotal: data.subtotal || 0,
    discount_type: data.discount_type || 'flat',
    discount_value: data.discount_value || 0,
    gst_percent: data.gst_percent || 0,
    gst_amount: data.gst_amount || 0,
    total: data.total || 0,
    amount_paid: data.amount_paid || 0,
    balance: data.balance !== undefined ? data.balance : (data.total || 0),
    status: data.status || 'unpaid',
    notes: data.notes || ''
  };
  
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .insert([billData])
    .select()
    .single();
    
  if (billError) {
    logSupabaseError('bills', 'INSERT', billData, billError);
    throw billError;
  }
  
  if (data.items && data.items.length > 0) {
    const itemsData = data.items.map(item => ({
      user_id: user?.id,
      bill_id: data.id,
      item_name: item.item_name,
      print_type: item.print_type,
      sides: item.sides,
      qty: item.qty,
      unit_price: item.unit_price,
      amount: item.amount || (parseFloat(item.qty) * parseFloat(item.unit_price))
    }));
    
    const { error: itemsError } = await supabase.from('bill_items').insert(itemsData);
    if (itemsError) {
      logSupabaseError('bill_items', 'INSERT_ITEMS', itemsData, itemsError);
      throw itemsError;
    }
  }
  
  return { data: { data: bill } };
}

export const updateBill = async (id, data) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const billData = {};
  if (data.customer_id !== undefined) billData.customer_id = data.customer_id;
  if (data.date !== undefined) billData.date = data.date;
  if (data.due_date !== undefined) billData.due_date = data.due_date;
  if (data.subtotal !== undefined) billData.subtotal = data.subtotal;
  if (data.discount_type !== undefined) billData.discount_type = data.discount_type;
  if (data.discount_value !== undefined) billData.discount_value = data.discount_value;
  if (data.gst_percent !== undefined) billData.gst_percent = data.gst_percent;
  if (data.gst_amount !== undefined) billData.gst_amount = data.gst_amount;
  if (data.total !== undefined) billData.total = data.total;
  if (data.amount_paid !== undefined) billData.amount_paid = data.amount_paid;
  if (data.balance !== undefined) billData.balance = data.balance;
  if (data.status !== undefined) billData.status = data.status;
  if (data.notes !== undefined) billData.notes = data.notes;
  
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .update(billData)
    .eq('id', id)
    .select()
    .single();
    
  if (billError) {
    logSupabaseError('bills', 'UPDATE', { id, billData }, billError);
    throw billError;
  }
  
  if (data.items) {
    const { error: deleteError } = await supabase.from('bill_items').delete().eq('bill_id', id);
    if (deleteError) {
      logSupabaseError('bill_items', 'DELETE_ITEMS_BEFORE_UPDATE', { bill_id: id }, deleteError);
    }
    
    if (data.items.length > 0) {
      const itemsData = data.items.map(item => ({
        user_id: user?.id,
        bill_id: id,
        item_name: item.item_name,
        print_type: item.print_type,
        sides: item.sides,
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.amount || (parseFloat(item.qty) * parseFloat(item.unit_price))
      }));
      const { error: itemsError } = await supabase.from('bill_items').insert(itemsData);
      if (itemsError) {
        logSupabaseError('bill_items', 'INSERT_ITEMS_ON_UPDATE', itemsData, itemsError);
        throw itemsError;
      }
    }
  }
  
  return { data: { data: bill } };
}

export const deleteBill = async (id) => {
  const { data, error } = await supabase
    .from('bills')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logSupabaseError('bills', 'SOFT_DELETE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}

export const restoreBill = async (id) => {
  const { data, error } = await supabase
    .from('bills')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) {
    logSupabaseError('bills', 'RESTORE', { id }, error);
    throw error;
  }
  return { data: { success: true } };
}

export const getDeletedBills = async () => {
  const { data, error } = await supabase
    .from('bills')
    .select('*, items:bill_items(*)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) {
    logSupabaseError('bills', 'SELECT_DELETED', {}, error);
    throw error;
  }
  return { data: { data } };
}

export const applyDiscount = async (id, discountData) => {
  const { discount_type, discount_value } = discountData;
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select('*')
    .eq('id', id)
    .single();
    
  if (billError) {
    logSupabaseError('bills', 'SELECT_BEFORE_DISCOUNT', { id }, billError);
    throw billError;
  }
  
  const subtotal = parseFloat(bill.subtotal || 0);
  const discountVal = parseFloat(discount_value || 0);
  const discountAmt = discount_type === 'percent' ? (subtotal * discountVal) / 100 : discountVal;
  const total = Math.max(subtotal - discountAmt, 0);
  const amountPaid = parseFloat(bill.amount_paid || 0);
  const balance = Math.max(total - amountPaid, 0);
  const status = amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid');
  
  const { data: updated, error } = await supabase
    .from('bills')
    .update({
      discount_type,
      discount_value: discountVal,
      total,
      balance,
      status
    })
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    logSupabaseError('bills', 'APPLY_DISCOUNT', { id, discountData }, error);
    throw error;
  }
  return { data: { data: updated } };
}
