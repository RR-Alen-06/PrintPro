export type PaymentMethod = 'Cash' | 'UPI' | 'Split Payment' | 'Advance Used';

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
