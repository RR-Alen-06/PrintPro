import { supabase } from '../lib/supabase'

export const getNotifications = async () => {
  const notifications = [];
  const today = new Date().toISOString().slice(0, 10);
  
  // 1. Fetch overdue bills
  const { data: overdue, error: overdueError } = await supabase
    .from('bills')
    .select('id, due_date, balance, customers(name)')
    .not('status', 'eq', 'paid')
    .lt('due_date', today)
    .is('deleted_at', null)
    .limit(20);
    
  if (overdueError) {
    console.error('Supabase Error in getNotifications (overdue):', overdueError);
    throw overdueError;
  }
  
  overdue.forEach((bill) => {
    notifications.push({
      id: `overdue-${bill.id}`,
      title: `Overdue: ${bill.id}`,
      message: `${bill.customers?.name || 'Customer'} owes ₹${parseFloat(bill.balance).toFixed(2)} — due ${bill.due_date}`,
      type: 'warning',
      read: false,
      date: new Date().toISOString().slice(0, 10),
    });
  });
  
  // 2. Fetch low stock items
  const { data: lowStock, error: lowStockError } = await supabase
    .from('inventory_items')
    .select('name, stock, low_stock_alert');
    
  if (lowStockError) {
    console.error('Supabase Error in getNotifications (lowStock):', lowStockError);
    throw lowStockError;
  }
  
  lowStock.forEach((item) => {
    if (Number(item.stock || 0) <= Number(item.low_stock_alert || 50)) {
      notifications.push({
        id: `stock-${item.name}`,
        title: `Low stock: ${item.name}`,
        message: `Only ${item.stock} units left (alert threshold: ${item.low_stock_alert})`,
        type: 'info',
        read: false,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  });
  
  return { data: { data: notifications } };
}
