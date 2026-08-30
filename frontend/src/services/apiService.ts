import { supabase } from '../lib/supabase';
import { SequenceService } from './sequenceService';
import { BillingService } from './billingService';
import { LedgerService } from './ledgerService';
import { ReconciliationService } from './reconciliationService';
import {
  CustomerSummary,
  CustomerLedgerEntry,
  BillFinancialSummary,
  DashboardStats,
  DateFilterOption,
  RoundingMethod,
  PaymentMethod,
  ExpenseRecord,
  ExpenseCategory,
} from '../types/billing';

export class ApiService {
  // ── SEQUENCE MANAGEMENT ──────────────────────────────────────────────────
  static async getNextSequence(key: string): Promise<string> {
    return SequenceService.getNextSequence(key);
  }

  // ── CUSTOMERS ────────────────────────────────────────────────────────────
  static async getCustomers(): Promise<any[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error fetching customers:', error.message);
      return [];
    }
    return (data || []).map((c) => ({
      ...c,
      phone: c.mobile || c.phone,
      advanceBalance: Number(c.advance_balance || 0),
      creditBalance: Number(c.advance_balance || 0),
      creditLimit: Number(c.credit_limit || 0),
      loyaltyPoints: Number(c.loyalty_points || 0),
    }));
  }

  static async getCustomerById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      ...data,
      phone: data.mobile || data.phone,
      advanceBalance: Number(data.advance_balance || 0),
      creditBalance: Number(data.advance_balance || 0),
      creditLimit: Number(data.credit_limit || 0),
      loyaltyPoints: Number(data.loyalty_points || 0),
    };
  }

  static async addCustomer(customer: {
    name: string;
    mobile?: string;
    phone?: string;
    email?: string;
    type?: 'regular' | 'walkin';
    credit_limit?: number;
    creditLimit?: number;
    advance_balance?: number;
    creditBalance?: number;
    opening_cash?: number;
    opening_upi?: number;
  }): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    const customer_code = await SequenceService.getNextSequence('CUSTOMER');
    const mobileVal = customer.mobile || customer.phone || null;
    const initialAdvance = Number(customer.advance_balance || customer.creditBalance || 0);

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          user_id: user?.id || null,
          customer_code,
          name: customer.name.trim(),
          mobile: mobileVal,
          email: customer.email?.trim() || null,
          type: customer.type || 'regular',
          credit_limit: Number(customer.credit_limit || customer.creditLimit || 0),
          advance_balance: initialAdvance,
          loyalty_points: 0,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // If opening advance provided, record initial payment
    if (initialAdvance > 0) {
      const opCash = Number(customer.opening_cash || 0);
      const opUpi = Number(customer.opening_upi || 0);
      const payMethod: PaymentMethod = opCash > 0 && opUpi > 0 ? 'Split Payment' : (opUpi > 0 ? 'UPI' : 'Cash');
      const pNum = await SequenceService.getNextSequence('PAYMENT');

      await supabase.from('payments').insert([
        {
          user_id: user?.id || null,
          payment_number: pNum,
          customer_id: data.id,
          amount: initialAdvance,
          payment_method: payMethod,
          notes: 'Opening advance credit balance',
        },
      ]);
    }

    return {
      ...data,
      phone: data.mobile || data.phone,
      advanceBalance: Number(data.advance_balance || 0),
      creditBalance: Number(data.advance_balance || 0),
      creditLimit: Number(data.credit_limit || 0),
      loyaltyPoints: Number(data.loyalty_points || 0),
    };
  }

  static async updateCustomer(
    id: string,
    updates: {
      name?: string;
      mobile?: string;
      phone?: string;
      email?: string;
      type?: 'regular' | 'walkin';
      credit_limit?: number;
      creditLimit?: number;
      advance_balance?: number;
      loyalty_points?: number;
    }
  ): Promise<any> {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.mobile !== undefined || updates.phone !== undefined) {
      payload.mobile = updates.mobile || updates.phone || null;
    }
    if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.credit_limit !== undefined || updates.creditLimit !== undefined) {
      payload.credit_limit = Number(updates.credit_limit !== undefined ? updates.credit_limit : updates.creditLimit);
    }
    if (updates.advance_balance !== undefined) payload.advance_balance = Number(updates.advance_balance);
    if (updates.loyalty_points !== undefined) payload.loyalty_points = Number(updates.loyalty_points);

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return {
      ...data,
      phone: data.mobile || data.phone,
      advanceBalance: Number(data.advance_balance || 0),
      creditBalance: Number(data.advance_balance || 0),
      creditLimit: Number(data.credit_limit || 0),
      loyaltyPoints: Number(data.loyalty_points || 0),
    };
  }

  static async getCustomerSummaries(): Promise<CustomerSummary[]> {
    const [customers, { data: bills }, { data: payments }] = await Promise.all([
      this.getCustomers(),
      supabase.from('bills').select('id, customer_id, grand_total, total, paid_total, amount_paid, deleted_at'),
      supabase.from('payments').select('id, customer_id, amount'),
    ]);

    const activeBills = bills || [];
    const activePayments = payments || [];

    return customers.map((c) =>
      LedgerService.computeCustomerSummary({
        customer: c,
        bills: activeBills,
        payments: activePayments,
      })
    );
  }

  static async getCustomerLedger(customerId: string): Promise<{
    customer: any;
    entries: CustomerLedgerEntry[];
    totalBilled: number;
    totalPaid: number;
    runningBalance: number;
    pendingPoints: number;
  }> {
    const [customer, { data: bills }, { data: payments }] = await Promise.all([
      this.getCustomerById(customerId),
      supabase
        .from('bills')
        .select('*')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true }),
    ]);

    if (!customer) throw new Error('Customer not found');

    const ledger = LedgerService.buildCustomerLedger({
      bills: bills || [],
      payments: payments || [],
    });

    let pendingPoints = 0;
    (bills || []).forEach((b) => {
      const gTotal = Number(b.grand_total !== undefined ? b.grand_total : (b.total || 0));
      const pTotal = Number(b.paid_total !== undefined ? b.paid_total : (b.amount_paid || 0));
      if (gTotal - pTotal > 0.01) {
        pendingPoints += Math.max(1, Math.floor(gTotal / 100));
      }
    });

    return {
      customer,
      ...ledger,
      pendingPoints,
    };
  }

  // ── BILLING & POS ATOMIC TRANSACTIONS ────────────────────────────────────
  static async createBill(billData: {
    customer_id?: string | null;
    customer_name?: string;
    total: number;
    discount: number;
    rounding_method?: RoundingMethod;
    rounding_adjustment?: number;
    grand_total: number;
    cash_paid: number;
    upi_paid: number;
    advance_used: number;
    points_to_redeem?: number;
    loyalty_points_earned?: number;
    notes?: string;
    items: Array<{
      item_id?: string | null;
      item_name: string;
      print_type?: string;
      sides?: string;
      qty: number;
      unit_price: number;
      amount: number;
      gst_rate?: number;
    }>;
  }): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Generate atomic Bill sequence
    const bill_number = await SequenceService.getNextSequence('BILL');

    const directPaid = Number(billData.cash_paid || 0) + Number(billData.upi_paid || 0);
    const advUsed = Number(billData.advance_used || 0);
    const paidTotal = directPaid + advUsed;
    const roundedTotal = Number(billData.grand_total || billData.total);
    const netDueForBill = roundedTotal - advUsed;

    // 2. Fetch prior unpaid bills for FIFO allocation if customer provided
    let priorOutstanding = 0;
    const priorUnpaidBillsList: Array<{ id: string; due: number; bill: any }> = [];

    if (billData.customer_id) {
      const { data: priorBills } = await supabase
        .from('bills')
        .select('*')
        .eq('customer_id', billData.customer_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      (priorBills || []).forEach((pb) => {
        const pbGrand = Number(pb.grand_total !== undefined ? pb.grand_total : (pb.total || 0));
        const pbPaid = Number(pb.paid_total !== undefined ? pb.paid_total : (pb.amount_paid || 0));
        const due = Math.max(0, pbGrand - pbPaid);
        if (due > 0.01) {
          priorOutstanding += due;
          priorUnpaidBillsList.push({ id: pb.id, due, bill: pb });
        }
      });
    }

    // 3. Overpayment math
    const overpayment = Math.max(0, directPaid - netDueForBill);
    const allocatedToPriorBills = Math.min(priorOutstanding, overpayment);
    const advanceEarned = overpayment - allocatedToPriorBills;
    const isFullyPaidAtCreation = paidTotal >= roundedTotal - 0.01;

    const payment_method: PaymentMethod =
      billData.cash_paid > 0 && billData.upi_paid > 0
        ? 'Split Payment'
        : billData.upi_paid > 0
        ? 'UPI'
        : advUsed > 0 && directPaid === 0
        ? 'Advance Used'
        : 'Cash';

    // 4. Insert Bill record
    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .insert([
        {
          user_id: user?.id || null,
          bill_number,
          customer_id: billData.customer_id || null,
          customer_name: billData.customer_name || 'Walk-in Customer',
          total: billData.total,
          discount: billData.discount,
          rounding_method: billData.rounding_method || 'None',
          rounding_adjustment: billData.rounding_adjustment || 0,
          grand_total: roundedTotal,
          cash_paid: billData.cash_paid,
          upi_paid: billData.upi_paid,
          paid_total: paidTotal,
          advance_used: advUsed,
          advance_earned: advanceEarned,
          payment_method,
          loyalty_points_earned: isFullyPaidAtCreation ? (billData.loyalty_points_earned || 0) : 0,
          loyalty_points_redeemed: billData.points_to_redeem || 0,
          notes: billData.notes || null,
          status: isFullyPaidAtCreation ? 'paid' : (paidTotal > 0.01 ? 'partial' : 'unpaid'),
        },
      ])
      .select()
      .single();

    if (billErr) throw new Error(billErr.message);

    // 5. Insert Bill Items
    if (billData.items && billData.items.length > 0) {
      const itemsToInsert = billData.items.map((item) => ({
        user_id: user?.id || null,
        bill_id: bill.id,
        item_id: item.item_id || null,
        item_name: item.item_name,
        print_type: item.print_type || 'color',
        sides: item.sides || 'single',
        qty: item.qty,
        unit_price: item.unit_price,
        amount: item.amount,
        gst_rate: item.gst_rate || 0,
      }));

      const { error: itemsErr } = await supabase.from('bill_items').insert(itemsToInsert);
      if (itemsErr) console.warn('Error inserting bill items:', itemsErr.message);
    }

    // 6. Insert Payment Records per method
    const cashForCurrentBill = Math.max(0, billData.cash_paid - allocatedToPriorBills);
    const remainingAlloc = Math.max(0, allocatedToPriorBills - billData.cash_paid);
    const upiForCurrentBill = Math.max(0, billData.upi_paid - remainingAlloc);

    if (cashForCurrentBill > 0) {
      const pNum = await SequenceService.getNextSequence('PAYMENT');
      await supabase.from('payments').insert([
        {
          user_id: user?.id || null,
          payment_number: pNum,
          customer_id: billData.customer_id || null,
          bill_id: bill.id,
          amount: cashForCurrentBill,
          payment_method: 'Cash',
          notes: `Cash payment for ${bill_number}`,
        },
      ]);
    }

    if (upiForCurrentBill > 0) {
      const pNum = await SequenceService.getNextSequence('PAYMENT');
      await supabase.from('payments').insert([
        {
          user_id: user?.id || null,
          payment_number: pNum,
          customer_id: billData.customer_id || null,
          bill_id: bill.id,
          amount: upiForCurrentBill,
          payment_method: 'UPI',
          notes: `UPI payment for ${bill_number}`,
        },
      ]);
    }

    // 7. Settle prior unpaid bills via FIFO allocation
    if (allocatedToPriorBills > 0 && billData.customer_id) {
      let remainingToAllocate = allocatedToPriorBills;
      for (const item of priorUnpaidBillsList) {
        if (remainingToAllocate <= 0) break;
        const alloc = Math.min(item.due, remainingToAllocate);
        remainingToAllocate -= alloc;

        const pbGrand = Number(item.bill.grand_total !== undefined ? item.bill.grand_total : item.bill.total);
        const pbCurrentPaid = Number(item.bill.paid_total !== undefined ? item.bill.paid_total : (item.bill.amount_paid || 0));
        const newPaidTotal = pbCurrentPaid + alloc;
        const isNowPaid = newPaidTotal >= pbGrand - 0.01;

        await supabase
          .from('bills')
          .update({
            paid_total: newPaidTotal,
            status: isNowPaid ? 'paid' : 'partial',
          })
          .eq('id', item.id);

        const pNum = await SequenceService.getNextSequence('PAYMENT');
        await supabase.from('payments').insert([
          {
            user_id: user?.id || null,
            payment_number: pNum,
            customer_id: billData.customer_id,
            bill_id: item.id,
            amount: alloc,
            payment_method: billData.upi_paid > billData.cash_paid ? 'UPI' : 'Cash',
            notes: `Automated FIFO allocation from Bill #${bill_number}`,
          },
        ]);
      }
    }

    // 8. Update customer advance & loyalty balances
    if (billData.customer_id) {
      const { data: custInfo } = await supabase
        .from('customers')
        .select('advance_balance, loyalty_points')
        .eq('id', billData.customer_id)
        .single();

      if (custInfo) {
        const curAdv = Number(custInfo.advance_balance || 0);
        const newAdv = Math.max(0, curAdv - advUsed + advanceEarned);
        const curLoyalty = Number(custInfo.loyalty_points || 0);
        const addedLoyalty = isFullyPaidAtCreation ? (billData.loyalty_points_earned || 0) : 0;
        const redeemedLoyalty = Number(billData.points_to_redeem || 0);
        const newLoyalty = Math.max(0, curLoyalty - redeemedLoyalty + addedLoyalty);

        await supabase
          .from('customers')
          .update({
            advance_balance: newAdv,
            loyalty_points: newLoyalty,
          })
          .eq('id', billData.customer_id);
      }
    }

    return {
      ...bill,
      items: billData.items,
    };
  }

  static async getBills(): Promise<any[]> {
    const { data: bills, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), customers(name, mobile, email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching bills:', error.message);
      return [];
    }

    return (bills || []).map((b) => ({
      ...b,
      invoiceNumber: b.bill_number,
      customerName: b.customers?.name || b.customer_name || 'Walk-in Customer',
      customerMobile: b.customers?.mobile || null,
      items: b.bill_items || [],
      subtotal: Number(b.total || 0),
      total: Number(b.grand_total || b.total || 0),
      amountPaid: Number(b.paid_total !== undefined ? b.paid_total : (b.amount_paid || 0)),
      balance: Math.max(0, Number(b.grand_total || b.total || 0) - Number(b.paid_total || 0)),
    }));
  }

  // ── RECORD DIRECT CUSTOMER PAYMENT ────────────────────────────────────────
  static async recordCustomerPayment(payment: {
    customer_id: string;
    amount: number;
    payment_method: PaymentMethod;
    bill_id?: string | null;
    notes?: string;
  }): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    const payment_number = await SequenceService.getNextSequence('PAYMENT');

    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          user_id: user?.id || null,
          payment_number,
          customer_id: payment.customer_id,
          bill_id: payment.bill_id || null,
          amount: payment.amount,
          payment_method: payment.payment_method,
          notes: payment.notes || null,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Apply FIFO to unpaid bills or direct bill payment
    if (payment.bill_id) {
      const { data: bill } = await supabase.from('bills').select('*').eq('id', payment.bill_id).single();
      if (bill) {
        const grandTotal = Number(bill.grand_total !== undefined ? bill.grand_total : bill.total);
        const currentPaid = Number(bill.paid_total !== undefined ? bill.paid_total : (bill.amount_paid || 0));
        const newPaidTotal = currentPaid + payment.amount;
        const isPaid = newPaidTotal >= grandTotal - 0.01;

        await supabase
          .from('bills')
          .update({
            paid_total: newPaidTotal,
            status: isPaid ? 'paid' : 'partial',
          })
          .eq('id', payment.bill_id);
      }
    } else {
      // FIFO allocation across all unpaid bills
      const { data: custBills } = await supabase
        .from('bills')
        .select('*')
        .eq('customer_id', payment.customer_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      let unallocated = payment.amount;
      for (const b of custBills || []) {
        if (unallocated <= 0) break;
        const grandTotal = Number(b.grand_total !== undefined ? b.grand_total : b.total);
        const paidTotal = Number(b.paid_total !== undefined ? b.paid_total : (b.amount_paid || 0));
        const due = Math.max(0, grandTotal - paidTotal);

        if (due > 0.01) {
          const alloc = Math.min(due, unallocated);
          unallocated -= alloc;
          const newPaid = paidTotal + alloc;
          const isPaid = newPaid >= grandTotal - 0.01;

          await supabase
            .from('bills')
            .update({
              paid_total: newPaid,
              status: isPaid ? 'paid' : 'partial',
            })
            .eq('id', b.id);
        }
      }

      // Remaining unallocated payment credited to customer advance_balance
      if (unallocated > 0) {
        const { data: cust } = await supabase.from('customers').select('advance_balance').eq('id', payment.customer_id).single();
        if (cust) {
          const curAdv = Number(cust.advance_balance || 0);
          await supabase.from('customers').update({ advance_balance: curAdv + unallocated }).eq('id', payment.customer_id);
        }
      }
    }

    return data;
  }

  // ── EXPENSES ─────────────────────────────────────────────────────────────
  static async getExpenses(): Promise<ExpenseRecord[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching expenses:', error.message);
      return [];
    }
    return data || [];
  }

  static async addExpense(expense: {
    title: string;
    amount: number;
    cash_amount?: number;
    upi_amount?: number;
    category: ExpenseCategory;
    date?: string;
    receipt_url?: string;
  }): Promise<ExpenseRecord> {
    const { data: { user } } = await supabase.auth.getUser();
    const expense_number = await SequenceService.getNextSequence('EXPENSE');

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: user?.id || null,
          expense_number,
          title: expense.title.trim(),
          amount: Number(expense.amount),
          category: expense.category || 'Shop Expense',
          created_at: expense.date ? new Date(expense.date).toISOString() : new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── DASHBOARD STATS ──────────────────────────────────────────────────────
  static async getDashboardStats(
    filter: DateFilterOption = 'today',
    customRange?: { from: string; to: string }
  ): Promise<DashboardStats> {
    const { startDate, endDate } = ReconciliationService.getDateRangeBounds(filter, customRange);

    let billsQuery = supabase.from('bills').select('*, bill_items(*)').is('deleted_at', null);
    let paymentsQuery = supabase.from('payments').select('*');
    let expensesQuery = supabase.from('expenses').select('*');

    if (startDate) {
      billsQuery = billsQuery.gte('created_at', startDate.toISOString());
      paymentsQuery = paymentsQuery.gte('created_at', startDate.toISOString());
      expensesQuery = expensesQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      billsQuery = billsQuery.lte('created_at', endDate.toISOString());
      paymentsQuery = paymentsQuery.lte('created_at', endDate.toISOString());
      expensesQuery = expensesQuery.lte('created_at', endDate.toISOString());
    }

    const [{ data: bills }, { data: payments }, { data: expenses }, customers] = await Promise.all([
      billsQuery,
      paymentsQuery,
      expensesQuery,
      this.getCustomerSummaries(),
    ]);

    const allBills = bills || [];
    const allPayments = payments || [];
    const allExpenses = expenses || [];

    const totalCustAdvance = customers.reduce((sum, c) => sum + Number(c.advance_balance || 0), 0);
    const paymentSummary = ReconciliationService.computePaymentReconciliation({
      bills: allBills,
      payments: allPayments,
      customersAdvanceBalance: totalCustAdvance,
    });

    const totalIncome = paymentSummary.total_amount_collected;
    const totalExpense = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;

    const billsCount = allBills.length;
    const avgBillValue = billsCount > 0 ? paymentSummary.total_sales / billsCount : 0;

    // Monthly Sales
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlySales = allBills
      .filter((b) => (b.created_at || '').startsWith(currentMonth))
      .reduce((sum, b) => sum + Number(b.grand_total || b.total || 0), 0);

    // Sales Trend
    const salesTrendMap = new Map<string, number>();
    allBills.forEach((b) => {
      const dateKey = new Date(b.created_at || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      });
      salesTrendMap.set(
        dateKey,
        (salesTrendMap.get(dateKey) || 0) + Number(b.grand_total || b.total || 0)
      );
    });
    const sales_trend = Array.from(salesTrendMap.entries()).map(([date, amount]) => ({ date, amount }));

    // Monthly Revenue
    const monthlyRevMap = new Map<string, number>();
    allBills.forEach((b) => {
      const monthKey = new Date(b.created_at || Date.now()).toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
      });
      monthlyRevMap.set(
        monthKey,
        (monthlyRevMap.get(monthKey) || 0) + Number(b.grand_total || b.total || 0)
      );
    });
    const monthly_revenue = Array.from(monthlyRevMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    // Payment Distribution
    const payment_distribution = [
      { name: 'Cash', value: paymentSummary.cash_collected },
      { name: 'UPI', value: paymentSummary.upi_collected },
    ].filter((p) => p.value > 0);

    // Top Products
    const prodMap = new Map<string, { quantity: number; revenue: number }>();
    allBills.forEach((b) => {
      (b.bill_items || []).forEach((item: any) => {
        const name = item.item_name || item.itemName || 'Item';
        const existing = prodMap.get(name) || { quantity: 0, revenue: 0 };
        prodMap.set(name, {
          quantity: existing.quantity + Number(item.qty || 1),
          revenue: existing.revenue + Number(item.amount || 0),
        });
      });
    });

    const top_products = Array.from(prodMap.entries())
      .map(([name, stat]) => ({ name, quantity: stat.quantity, revenue: stat.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      todays_sales: paymentSummary.total_sales,
      monthly_sales: monthlySales,
      todays_bills_count: billsCount,
      pending_balance: paymentSummary.outstanding_amount,
      total_customers: customers.length,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_profit: netProfit,
      bills_generated: billsCount,
      average_bill_value: avgBillValue,
      payment_summary: paymentSummary,
      sales_trend,
      monthly_revenue,
      payment_distribution,
      top_products,
    };
  }
}
