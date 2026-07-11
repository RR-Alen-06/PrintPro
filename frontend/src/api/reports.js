import { supabase } from '../lib/supabase'

export const getDailyReport = async (date) => {
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('*, customers(name)')
    .eq('date', selectedDate)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
    
  if (billsError) throw billsError;
  
  const formattedBills = bills.map(b => ({
    ...b,
    customer_name: b.customers?.name || ''
  }));
  
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('date', selectedDate);
    
  if (paymentsError) throw paymentsError;
  
  const refunds = payments.filter(p => p.payment_type === 'refund' || p.total_paid < 0);
  const totalRefunds = refunds.reduce((s, p) => s + Math.abs(p.total_paid || 0), 0);
  const cashRefunded = refunds.reduce((s, p) => s + Math.abs(p.cash_amount || 0), 0);
  const upiRefunded = refunds.reduce((s, p) => s + Math.abs(p.upi_amount || 0), 0);
  
  const totalBilled = formattedBills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
  const totalPaid = formattedBills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
  const totalDue = formattedBills.reduce((s, b) => s + parseFloat(b.balance || 0), 0);
  
  return {
    data: {
      data: {
        date: selectedDate,
        bills: formattedBills,
        summary: {
          total_billed: totalBilled,
          total_paid: totalPaid,
          total_due: totalDue,
          total_refunds: totalRefunds,
          net_sales: totalBilled,
          net_paid: totalPaid,
          cash_refunded: cashRefunded,
          upi_refunded: upiRefunded,
          bill_count: formattedBills.length
        }
      }
    }
  };
}

export const getMonthlyReport = async (year, month) => {
  const now = new Date();
  const y = parseInt(year, 10) || now.getFullYear();
  const m = parseInt(month, 10) || (now.getMonth() + 1);
  const pad = String(m).padStart(2, '0');
  const monthStr = `${y}-${pad}`;
  
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('*, customers(name)')
    .like('date', `${monthStr}%`)
    .is('deleted_at', null)
    .order('date', { ascending: false });
    
  if (billsError) throw billsError;
  
  const formattedBills = bills.map(b => ({
    ...b,
    customer_name: b.customers?.name || ''
  }));
  
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .like('date', `${monthStr}%`);
    
  if (paymentsError) throw paymentsError;
  
  const refunds = payments.filter(p => p.payment_type === 'refund' || p.total_paid < 0);
  const totalRefunds = refunds.reduce((s, p) => s + Math.abs(p.total_paid || 0), 0);
  const cashRefunded = refunds.reduce((s, p) => s + Math.abs(p.cash_amount || 0), 0);
  const upiRefunded = refunds.reduce((s, p) => s + Math.abs(p.upi_amount || 0), 0);
  
  const totalBilled = formattedBills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
  const totalPaid = formattedBills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
  
  return {
    data: {
      data: {
        year: y,
        month: m,
        bills: formattedBills,
        summary: {
          total_billed: totalBilled,
          total_paid: totalPaid,
          total_refunds: totalRefunds,
          net_sales: totalBilled,
          net_paid: totalPaid,
          cash_refunded: cashRefunded,
          upi_refunded: upiRefunded,
          bill_count: formattedBills.length
        }
      }
    }
  };
}

export const getYearlyReport = async (year) => {
  const y = parseInt(year, 10) || new Date().getFullYear();
  const yearStr = `${y}`;
  
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('*')
    .like('date', `${yearStr}%`)
    .is('deleted_at', null);
    
  if (billsError) throw billsError;
  
  const monthlyMap = {};
  bills.forEach(b => {
    const month = b.date.slice(0, 7);
    if (!monthlyMap[month]) {
      monthlyMap[month] = { month, bill_count: 0, total_billed: 0, total_paid: 0 };
    }
    monthlyMap[month].bill_count += 1;
    monthlyMap[month].total_billed += parseFloat(b.total || 0);
    monthlyMap[month].total_paid += parseFloat(b.amount_paid || 0);
  });
  
  const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  
  const totalBilled = bills.reduce((s, b) => s + parseFloat(b.total || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + parseFloat(b.amount_paid || 0), 0);
  
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .like('date', `${yearStr}%`);
    
  if (paymentsError) throw paymentsError;
  
  const refunds = payments.filter(p => p.payment_type === 'refund' || p.total_paid < 0);
  const totalRefunds = refunds.reduce((s, p) => s + Math.abs(p.total_paid || 0), 0);
  const cashRefunded = refunds.reduce((s, p) => s + Math.abs(p.cash_amount || 0), 0);
  const upiRefunded = refunds.reduce((s, p) => s + Math.abs(p.upi_amount || 0), 0);
  
  return {
    data: {
      data: {
        year: y,
        monthly,
        summary: {
          bill_count: bills.length,
          total_billed: totalBilled,
          total_paid: totalPaid,
          total_refunds: totalRefunds,
          net_sales: totalBilled,
          net_paid: totalPaid,
          cash_refunded: cashRefunded,
          upi_refunded: upiRefunded
        }
      }
    }
  };
}

export const getReceivables = async () => {
  const { data, error } = await supabase
    .from('bills')
    .select('*, customers(id, name, phone)')
    .not('status', 'eq', 'paid')
    .is('deleted_at', null)
    .order('balance', { ascending: false });
    
  if (error) throw error;
  
  const formatted = data.map(b => ({
    id: b.id,
    date: b.date,
    due_date: b.due_date,
    total: b.total,
    amount_paid: b.amount_paid,
    balance: b.balance,
    status: b.status,
    customer_id: b.customers?.id || '',
    customer_name: b.customers?.name || '',
    customer_phone: b.customers?.phone || ''
  }));
  
  return { data: { data: formatted } };
}

export const getTopCustomers = async (period) => {
  const selectedPeriod = period || 'all';
  const now = new Date();
  
  let billsQuery = supabase.from('bills').select('customer_id, total, amount_paid').is('deleted_at', null);
  if (selectedPeriod === 'monthly') {
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    billsQuery = billsQuery.like('date', `${monthStr}%`);
  } else if (selectedPeriod === 'yearly') {
    billsQuery = billsQuery.like('date', `${now.getFullYear()}%`);
  }
  
  const [customersRes, billsRes] = await Promise.all([
    supabase.from('customers').select('id, name'),
    billsQuery
  ]);
  
  if (customersRes.error) throw customersRes.error;
  if (billsRes.error) throw billsRes.error;
  
  const customerMap = {};
  customersRes.data.forEach(c => {
    customerMap[c.id] = { id: c.id, name: c.name, bill_count: 0, total_billed: 0, total_paid: 0 };
  });
  
  billsRes.data.forEach(b => {
    if (customerMap[b.customer_id]) {
      customerMap[b.customer_id].bill_count += 1;
      customerMap[b.customer_id].total_billed += parseFloat(b.total || 0);
      customerMap[b.customer_id].total_paid += parseFloat(b.amount_paid || 0);
    }
  });
  
  const sorted = Object.values(customerMap)
    .sort((a, b) => b.total_billed - a.total_billed)
    .slice(0, 10);
    
  return { data: { data: sorted } };
}

export const getBestItems = async (period) => {
  const selectedPeriod = period || 'all';
  const now = new Date();
  
  let billsQuery = supabase.from('bills').select('id').is('deleted_at', null);
  if (selectedPeriod === 'monthly') {
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    billsQuery = billsQuery.like('date', `${monthStr}%`);
  } else if (selectedPeriod === 'yearly') {
    billsQuery = billsQuery.like('date', `${now.getFullYear()}%`);
  }
  
  const { data: bills, error: billsError } = await billsQuery;
  if (billsError) throw billsError;
  
  const billIds = bills.map(b => b.id);
  if (billIds.length === 0) {
    return { data: { data: [] } };
  }
  
  const { data: items, error: itemsError } = await supabase
    .from('bill_items')
    .select('item_name, print_type, sides, qty, amount')
    .in('bill_id', billIds);
    
  if (itemsError) throw itemsError;
  
  const itemMap = {};
  items.forEach(i => {
    const key = `${i.item_name}-${i.print_type}-${i.sides}`;
    if (!itemMap[key]) {
      itemMap[key] = {
        item_name: i.item_name,
        print_type: i.print_type,
        sides: i.sides,
        total_qty: 0,
        total_revenue: 0
      };
    }
    itemMap[key].total_qty += Number(i.qty || 0);
    itemMap[key].total_revenue += parseFloat(i.amount || 0);
  });
  
  const sorted = Object.values(itemMap)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);
    
  return { data: { data: sorted } };
}
