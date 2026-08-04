export type CustomerType = 'regular' | 'random';
export type DiscountType = 'percent' | 'flat';
export type BillStatus = 'unpaid' | 'partial' | 'paid';
export type PrintType = 'color' | 'bw';
export type SidesType = 'single' | 'double';
export type PaymentType = 'full' | 'partial';

export interface BusinessProfile {
  id: number;
  user_id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  gstin: string;
  logo_path: string;
  upi_id: string;
  advance_payments?: Array<{
    id: string;
    customerId: string;
    amount: number;
    date: string;
    paymentMode?: string;
    notes?: string;
    isRefundCredit?: boolean;
  }>;
}

export interface Customer {
  id: string;
  user_id: string;
  type: CustomerType;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_balance?: number;
  credit_limit?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: number;
  user_id: string;
  name: string;
  color_single?: number;
  color_double?: number;
  bw_single?: number;
  bw_double?: number;
  stock?: number;
  low_stock_alert?: number;
  created_at?: string;
}

export interface BillItem {
  id?: number;
  user_id?: string;
  bill_id: string;
  item_name: string;
  print_type: PrintType;
  sides: SidesType;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface Bill {
  id: string;
  user_id: string;
  customer_id: string;
  date: string;
  due_date?: string | null;
  subtotal: number;
  discount_type?: DiscountType;
  discount_value?: number;
  gst_percent?: number;
  gst_amount?: number;
  total: number;
  amount_paid: number;
  balance: number;
  status?: BillStatus;
  notes?: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: BillItem[];
}

export interface Payment {
  id?: number;
  user_id: string;
  bill_id: string;
  customer_id: string;
  date?: string;
  cash_amount?: number;
  upi_amount?: number;
  total_paid: number;
  payment_type: PaymentType;
  notes?: string;
}

export interface Purchase {
  id?: number;
  user_id: string;
  date: string;
  item_name: string;
  category: string;
  qty?: number;
  unit_cost?: number;
  total: number;
  notes?: string;
  created_at?: string;
}

export interface Database {
  public: {
    Tables: {
      business_profile: { Row: BusinessProfile };
      customers: { Row: Customer };
      inventory_items: { Row: InventoryItem };
      bills: { Row: Bill };
      bill_items: { Row: BillItem };
      payments: { Row: Payment };
      purchases: { Row: Purchase };
    };
  };
}
