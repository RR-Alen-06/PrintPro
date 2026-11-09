export type PaymentMethod = 'Cash' | 'UPI' | 'Split Payment' | 'Advance Used' | 'Pay Later';

export type ExpenseCategory = string;
export type ExpensePaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Other';

export type RoundingMethod = 'None' | 'Round Down' | 'Round Up' | 'Standard';

export type DateFilterOption = 
  | 'all_time'
  | 'today' 
  | 'yesterday' 
  | 'weekly' 
  | 'monthly' 
  | 'quarterly' 
  | 'yearly' 
  | 'financial_year' 
  | 'specific_date' 
  | 'current_session'
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

export interface Customer {
  id: string;
  user_id?: string | null;
  customer_code?: string | null;
  name: string;
  mobile?: string | null;
  email?: string | null;
  advance_balance: number;
  loyalty_points: number;
  created_at: string;
}

export interface Product {
  id: string;
  user_id?: string | null;
  product_code?: string | null;
  name: string;
  category: string;
  price: number;
  created_at?: string;
}

export interface BillItem {
  id?: string;
  user_id?: string | null;
  bill_id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  created_at?: string;
}

export interface Bill {
  id: string;
  user_id?: string | null;
  bill_number: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_mobile?: string | null;
  customer_email?: string | null;
  total: number;
  discount: number;
  gst_amount?: number;
  rounding_method: RoundingMethod;
  rounding_adjustment: number;
  grand_total: number;
  cash_paid: number;
  upi_paid: number;

  paid_total: number;
  advance_used: number;
  advance_earned: number;
  payment_method: string;
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  loyalty_discount_applied?: number;
  edited_at?: string | null;
  edited_by?: string | null;
  edit_reason?: string | null;
  group_bill_id?: string | null;
  group_role?: 'PRIMARY_PAYER' | 'MEMBER' | 'STANDALONE' | string;
  paid_by_customer_id?: string | null;
  paid_by_customer_name?: string;
  status?: 'COMPLETED' | 'CANCELLED' | 'VOID';
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  created_at: string;
  items?: BillItem[];
  financial_summary?: BillFinancialSummary;
}

export type GroupBillingType = 'SPLIT' | 'SHARED';

export interface GroupBillItem {
  id?: string;
  user_id?: string | null;
  group_bill_id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  created_at?: string;
}

export interface GroupBill {
  id: string;
  user_id?: string | null;
  group_bill_number: string;
  billing_type: GroupBillingType;
  total_amount: number;
  discount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  participant_count: number;
  primary_payer_id?: string | null;
  primary_payer_name?: string;
  status: 'COMPLETED' | 'PARTIALLY_CANCELLED' | 'CANCELLED';
  notes?: string | null;
  created_at: string;
  items?: GroupBillItem[];
  bills?: Bill[];
}

export interface CreateSplitBillingInput {
  items: Array<{
    product_id?: string | null;
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  customer_ids: string[];
  discount_per_customer?: number;
  rounding_method?: RoundingMethod;
  notes?: string;
  payments_override?: Record<string, {
    use_advance?: boolean;
    cash_paid?: number;
    upi_paid?: number;
    payment_method?: string;
  }>;
}

export interface SharedBillingParticipantInput {
  customer_id?: string | null; // null for Walk-in / Guest
  customer_name?: string;
  share_amount: number;
  paid_by_customer_id?: string | null; // If another person is paying or taking liability
  liability_payer_id?: string | null; // If absorbed into another person's Pay Later
  cash_paid?: number;
  upi_paid?: number;
  use_advance?: boolean;
  payment_method?: string;
}

export interface CreateSharedBillingInput {
  items: Array<{
    product_id?: string | null;
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  discount?: number;
  rounding_method?: RoundingMethod;
  notes?: string;
  primary_payer_id?: string | null;
  participants: SharedBillingParticipantInput[];
}

export interface EditBillInput {
  customer_id?: string | null;
  items: Array<{
    id?: string;
    product_id?: string | null;
    product_name: string;
    quantity: number;
    price: number;
    total?: number;
  }>;
  discount: number;
  rounding_method?: RoundingMethod;
  payment_method: string;
  cash_paid: number;
  upi_paid: number;
  advance_used?: number;
  reason: string;
  userName?: string;
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
    total_pending_points?: number;
    message: string;
  };
}


export interface Payment {
  id: string;
  user_id?: string | null;
  payment_number?: string | null;
  customer_id: string;
  customer_name?: string | null;
  customer_mobile?: string | null;
  bill_id?: string | null;
  bill_number?: string | null;
  amount: number;
  payment_method: string;
  notes?: string | null;
  created_at: string;
  status?: 'COMPLETED' | 'CANCELLED' | 'REVERSED';
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
}

export interface Expense {
  id: string;
  user_id?: string | null;
  expense_number?: string | null;
  title: string;
  amount: number;
  cash_amount?: number;
  upi_amount?: number;
  category: ExpenseCategory;
  payment_mode?: ExpensePaymentMode | 'Split' | string;
  notes?: string | null;
  created_at: string;
}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  type: 'BILL' | 'PAYMENT' | 'ADVANCE_USED' | 'OPENING_BALANCE' | 'LOYALTY_REDEEM';
  reference_no: string;
  description: string;
  bill_amount: number;
  paid_amount: number;
  advance_used: number;
  direct_paid?: number;
  bill_due?: number;
  is_fully_paid?: boolean;
  loyalty_points: number;
  running_balance: number;
  bill_id?: string;
  payment_method?: string;
  items?: {
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
}

export interface CustomerSummary {
  id: string;
  user_id?: string | null;
  customer_code?: string | null;
  name: string;
  mobile?: string | null;
  email?: string | null;
  total_billed: number;
  total_paid: number;
  balance_due: number;
  advance_balance: number;
  loyalty_points: number;
  created_at: string;
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

// Simplified Loyalty Earning & Redemption Models
export interface LoyaltyRule {
  id: string;
  user_id?: string | null;
  rule_name: string;
  min_bill_amount: number;
  max_bill_amount?: number | null;
  points_earned: number;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
}

export interface LoyaltyRedemptionRule {
  id: string;
  user_id?: string | null;
  points_required: number;
  discount_amount: number;
  enabled: boolean;
  created_at?: string;
}

export type LoyaltyCalculationMode = 'rate' | 'tier';

export interface LoyaltySettings {
  enabled: boolean;
  calculation_mode?: LoyaltyCalculationMode;
  earn_points?: number;
  earn_spend_unit?: number;
  points_required: number; // Fallback
  discount_value: number;  // Fallback
}

// System Settings Models
export interface ShopSettings {
  shop_name: string;
  address: string;
  phone: string;
  email: string;
  gst_number: string;
  logo_url: string;
  footer_message: string;
}

export interface BillingSettings {
  bill_prefix: string;
  bill_format: string;
  default_payment_method: string;
  currency_symbol: string;
  decimal_precision: number;
  gst_enabled: boolean;
  gst_rate: number;
  default_printer_size: '80mm' | 'A4';
  auto_print: boolean;
  rounding_method: RoundingMethod;
}

export interface WhatsAppSettings {
  enabled: boolean;
  template_text: string;
  enable_pdf_sharing: boolean;
  enable_text_sharing: boolean;
  email_service_id?: string;
  email_template_id?: string;
  email_public_key?: string;
}

export interface SecuritySettings {
  super_admin_pin: string;
  session_timeout_minutes: number;
  payment_reversal_window_hours?: number;
}

export interface ApplicationSettings {
  theme: 'light' | 'dark' | 'system';
  date_format: string;
  time_format: string;
}

export interface ExpenseSettings {
  categories: string[];
  default_payment_mode?: ExpensePaymentMode | string;
}

export interface AllSettings {
  shop: ShopSettings;
  billing: BillingSettings;
  loyalty: LoyaltySettings;
  whatsapp: WhatsAppSettings;
  security: SecuritySettings;
  app: ApplicationSettings;
  expenses?: ExpenseSettings;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  audit_number?: string | null;
  user_name: string;
  action: string;
  entity: string;
  previous_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  user_id?: string | null;
  transaction_number?: string | null;
  customer_id: string;
  bill_id?: string | null;
  points: number;
  type: 'EARN' | 'REDEEM' | 'ADJUST';
  notes?: string | null;
  created_at: string;
}

export interface ProductSalesHistoryItem {
  bill_id: string;
  bill_number: string;
  created_at: string;
  customer_id?: string | null;
  customer_name?: string | null;
  quantity: number;
  price: number;
  total: number;
  is_custom_rate: boolean;
  catalog_price: number;
}

export interface ProductSalesAnalytics {
  product: Product;
  total_quantity_sold: number;
  total_revenue: number;
  average_selling_rate: number;
  orders_count: number;
  transactions: ProductSalesHistoryItem[];
}

export interface CustomItemAnalytics {
  name: string;
  total_quantity: number;
  total_revenue: number;
  average_selling_rate: number;
  orders_count: number;
  first_used_at: string;
  last_used_at: string;
}

export interface CustomerStatementBillItem {
  item_index: number;
  product_id?: string | null;
  product_name: string;
  is_custom_item?: boolean;
  quantity: number;
  price: number;
  total: number;
}

export interface CustomerStatementBill {
  bill_id: string;
  bill_number: string;
  created_at: string;
  items: CustomerStatementBillItem[];
  subtotal: number;
  discount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  advance_used?: number;
  advance_earned?: number;
}

export interface CustomerStatementDateGroup {
  date_formatted: string;
  raw_date: string;
  bills: CustomerStatementBill[];
}

export interface CustomerStatementTransaction {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'OPENING_BALANCE' | 'REFUND' | 'ADVANCE_REFUND' | 'ADJUSTMENT';
  reference_no: string;
  bill_id?: string;
  particulars: string;
  debit: number;
  credit: number;
  running_balance: number;
  advance_used?: number;
  direct_paid?: number;
  bill_due?: number;
  is_fully_paid?: boolean;
  payment_method?: string;
  status?: string;
  items?: CustomerStatementBillItem[];
}

export interface CustomerStatementFinancialSummary {
  opening_balance: number;
  total_bills: number;
  total_billed: number;
  total_cash_received: number;
  total_upi_received: number;
  total_mixed_payments: number;
  total_advance_received: number;
  total_advance_utilized: number;
  total_advance_refunded: number;
  total_bill_refunds: number;
  total_outstanding: number;
  closing_balance: number;
}

export interface CustomerStatementData {
  customer: Customer;
  shop_settings: ShopSettings;
  period: {
    filter_label: string;
    start_date?: string;
    end_date?: string;
  };
  opening_balance: number; // >0 Due (Dr), <0 Adv (Cr)
  closing_balance: number; // Balance at end of period
  current_advance_balance: number; // Live unspent advance
  current_balance_due: number; // Live outstanding dues
  financial_summary: CustomerStatementFinancialSummary;
  kpi: {
    total_invoiced: number; // Period Debits
    total_paid: number; // Period Credits
    invoices_count: number;
    payments_count: number;
    total_units_bought: number;
  };
  transactions: CustomerStatementTransaction[];
  date_groups: CustomerStatementDateGroup[];
  reconciliation: {
    period_purchases: number;
    period_payments: number;
    current_outstanding_balance: number;
    advance_balance: number;
  };
}

export interface InternalTransfer {
  id: string;
  user_id?: string | null;
  transfer_number?: string | null;
  direction: 'CASH_TO_UPI' | 'UPI_TO_CASH';
  amount: number;
  reason: string;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AccountingClosing {
  id: string;
  user_id?: string | null;
  closing_number?: string | null;
  from_date: string;
  to_date: string;
  opening_cash: number;
  opening_upi: number;
  cash_inflow: number;
  upi_inflow: number;
  cash_outflow: number;
  upi_outflow: number;
  transfers_cash_to_upi: number;
  transfers_upi_to_cash: number;
  expected_cash: number;
  expected_upi: number;
  actual_cash: number;
  actual_upi: number;
  cash_difference: number;
  upi_difference: number;
  discrepancy_note?: string | null;
  status: 'CLOSED';
  is_locked: boolean;
  closed_by: string;
  closed_at: string;
  last_audited_at?: string | null;
  last_audited_by?: string | null;
  audit_notes?: string | null;
  denominations?: Record<string, number>;
  opening_advance_pool?: number;
  advance_received?: number;
  advance_utilized?: number;
  closing_advance_pool?: number;
}

export interface CurrentSessionStatus {
  last_closed_session: AccountingClosing | null;
  session_start_date: string;
  opening_cash: number;
  opening_upi: number;
  opening_advance_pool?: number;
  current_sales: number;
  current_cash_inflow: number;
  current_upi_inflow: number;
  current_cash_outflow: number;
  current_upi_outflow: number;
  current_transfers_cash_to_upi: number;
  current_transfers_upi_to_cash: number;
  expected_cash_in_hand: number;
  expected_upi_in_hand: number;
  bills_count: number;
  expenses_count: number;
  transfers_count: number;
  current_advance_received?: number;
  current_advance_utilized?: number;
  pending_dues_total?: number;
  unpaid_bills_count?: number;
  customer_advances_total?: number;
}

export interface UnpaidSessionBill {
  id: string;
  bill_number: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_mobile?: string | null;
  customer_advance?: number;
  grand_total: number;
  paid_total: number;
  due_amount: number;
  created_at: string;
}

export interface ReconciliationCalculation {
  from_date: string;
  to_date: string;
  opening_cash: number;
  opening_upi: number;
  opening_advance_pool?: number;
  cash_inflow: number;
  upi_inflow: number;
  advance_received?: number;
  advance_utilized?: number;
  closing_advance_pool?: number;
  cash_outflow: number;
  upi_outflow: number;
  transfers_cash_to_upi: number;
  transfers_upi_to_cash: number;
  expected_cash: number;
  expected_upi: number;
  total_sales: number;
  bills_count: number;
  expenses_count: number;
  transfers_count: number;
  pending_session_dues: number;
  unpaid_bills: UnpaidSessionBill[];
}


