export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Split Payment' | 'Advance Used' | 'Other';

export type ExpenseCategory = 
  | 'Shop Expense' 
  | 'Electricity' 
  | 'Rent' 
  | 'Raw Materials/Paper'
  | 'Maintenance'
  | 'Other Expense'
  | string;

export type RoundingMethod = 'None' | 'Round Down' | 'Round Up' | 'Standard';

export type DateFilterOption = 
  | 'today' 
  | 'yesterday' 
  | 'weekly' 
  | 'monthly' 
  | 'quarterly' 
  | 'yearly' 
  | 'financial_year' 
  | 'specific_date' 
  | 'custom';

export interface SequenceConfig {
  id?: string;
  user_id?: string | null;
  key: string;
  prefix: string;
  padding: number;
  current_val: number;
  updated_at?: string;
}

export interface CustomerSummary {
  id: string;
  user_id?: string | null;
  customer_code?: string | null;
  name: string;
  mobile?: string | null;
  email?: string | null;
  type?: 'regular' | 'walkin';
  credit_limit?: number;
  total_billed: number;
  total_paid: number;
  balance_due: number;
  advance_balance: number;
  loyalty_points: number;
  created_at: string;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  type: 'BILL' | 'PAYMENT' | 'ADVANCE_USED' | 'ADVANCE_RETURN' | 'LOYALTY_REDEEM';
  reference_no: string;
  description: string;
  bill_amount: number;
  paid_amount: number;
  advance_used: number;
  loyalty_points: number;
  running_balance: number;
}

export interface BillFinancialSummary {
  previous_outstanding: number;
  previous_advance: number;
  current_bill_amount: number;
  total_amount_due: number;
  cash_paid: number;
  upi_paid: number;
  advance_used: number;
  total_paid: number;
  remaining_balance: number;
  remaining_advance_balance: number;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Payment Pending';
  loyalty?: {
    enabled: boolean;
    is_fully_paid: boolean;
    points_awarded: boolean;
    points_earned: number;
    points_redeemed: number;
    previous_points: number;
    current_points_balance: number;
    message: string;
  };
}

export interface PaymentSummary {
  total_sales: number;
  cash_collected: number;
  upi_collected: number;
  total_amount_collected: number;
  outstanding_amount: number;
  customer_advance_balance: number;
  payment_method_breakdown: { method: string; amount: number }[];
  daily_collection_trend: { date: string; cash: number; upi: number; total: number }[];
  monthly_collection_trend: { month: string; amount: number }[];
}

export interface DashboardStats {
  todays_sales: number;
  monthly_sales: number;
  todays_bills_count: number;
  pending_balance: number;
  total_customers: number;
  total_income: number;
  total_expense: number;
  net_profit: number;
  bills_generated: number;
  average_bill_value: number;
  payment_summary: PaymentSummary;
  sales_trend: { date: string; amount: number }[];
  monthly_revenue: { month: string; amount: number }[];
  payment_distribution: { name: string; value: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
}

export interface ExpenseRecord {
  id: string;
  user_id?: string | null;
  expense_number?: string | null;
  title: string;
  amount: number;
  cash_amount?: number;
  upi_amount?: number;
  category: ExpenseCategory;
  date?: string;
  receipt_url?: string;
  created_at: string;
}

export interface StatementLineItem {
  item_index: number;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  unit?: string;
}

export interface StatementInvoice {
  id: string;
  bill_number: string;
  created_at: string;
  date: string;
  subtotal: number;
  discount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  items: StatementLineItem[];
}

export interface CustomerStatementData {
  store: {
    shopName: string;
    address: string;
    phone: string;
    email?: string;
    gstin?: string;
    taxNumber?: string;
    upiId?: string;
  };
  customer: {
    id: string;
    customer_code?: string;
    name: string;
    mobile?: string;
    email?: string;
    address?: string;
    gst_number?: string;
  };
  period: {
    key: string;
    label: string;
    startDate?: string | null;
    endDate?: string | null;
    issueDate: string;
  };
  kpi: {
    total_invoiced: number;
    total_paid: number;
    invoices_count: number;
    total_units_bought: number;
  };
  reconciliation: {
    period_purchases: number;
    period_payments: number;
    all_time_billed: number;
    all_time_paid: number;
    current_outstanding_balance: number;
    advance_balance: number;
  };
  invoices: StatementInvoice[];
  grouped_by_date: {
    date: string;
    invoices: StatementInvoice[];
    day_total: number;
  }[];
}

export interface ProductTransactionHistory {
  bill_id: string;
  bill_number: string;
  created_at: string;
  customer_id?: string;
  customer_name: string;
  quantity: number;
  price: number;
  total: number;
  catalog_price: number;
  is_custom_rate: boolean;
}

export interface ProductSalesAnalyticsData {
  product_id: string;
  product_code?: string;
  product_name: string;
  category?: string;
  catalog_price: number;
  total_quantity_sold: number;
  total_revenue: number;
  average_selling_rate: number;
  orders_count: number;
  min_rate: number;
  max_rate: number;
  has_price_variance: boolean;
  transaction_history: ProductTransactionHistory[];
}

export interface CustomItemAnalyticsData {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  average_selling_rate: number;
  min_rate: number;
  max_rate: number;
  is_dynamic_rate: boolean;
  orders_count: number;
  first_used_at: string;
  last_used_at: string;
  transaction_history: ProductTransactionHistory[];
}

export interface PrintVariantItemBreakdown {
  name: string;
  quantity: number;
  revenue: number;
  avg_rate: number;
}

export interface PrintVariantAnalyticsData {
  variant_key: string;
  variant_label: string;
  paper_size?: string;
  print_type?: string;
  sides?: string;
  total_quantity: number;
  total_revenue: number;
  average_rate: number;
  min_rate: number;
  max_rate: number;
  orders_count: number;
  item_breakdown: PrintVariantItemBreakdown[];
  transaction_history: ProductTransactionHistory[];
}

