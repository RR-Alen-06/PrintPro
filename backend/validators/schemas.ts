import { z } from 'zod';

export const customerSchema = z.object({
  id: z.string().optional(),
  customer_code: z.string().optional(),
  type: z.enum(['regular', 'random']).default('regular'),
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional().default(''),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional().default(''),
  credit_balance: z.number().nonnegative().optional().default(0),
  credit_limit: z.number().nonnegative().optional().default(0)
});

export const inventoryItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().min(1, 'Item name is required'),
  color_single: z.number().nonnegative().optional().default(0),
  color_double: z.number().nonnegative().optional().default(0),
  bw_single: z.number().nonnegative().optional().default(0),
  bw_double: z.number().nonnegative().optional().default(0),
  stock: z.number().int().nonnegative().optional().default(0),
  low_stock_alert: z.number().int().nonnegative().optional().default(50)
});

export const billItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  print_type: z.enum(['color', 'bw']).default('color'),
  sides: z.enum(['single', 'double']).default('single'),
  qty: z.number().int().positive('Quantity must be at least 1'),
  unit_price: z.number().nonnegative('Unit price cannot be negative'),
  amount: z.number().nonnegative()
});

export const billSchema = z.object({
  id: z.string().optional(),
  invoice_number: z.string().optional(),
  customer_id: z.string().min(1, 'Customer ID is required'),
  date: z.string().min(1, 'Date is required'),
  due_date: z.string().nullable().optional(),
  subtotal: z.number().nonnegative().default(0),
  discount_type: z.enum(['percent', 'flat']).default('flat'),
  discount_value: z.number().nonnegative().default(0),
  gst_percent: z.number().nonnegative().default(0),
  gst_amount: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  amount_paid: z.number().nonnegative().default(0),
  balance: z.number().nonnegative().default(0),
  status: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  notes: z.string().optional().default(''),
  items: z.array(billItemSchema).optional()
});

export const updateBillSchema = billSchema.partial();

export const paymentSchema = z.object({
  bill_id: z.string().min(1, 'Bill ID is required'),
  customer_id: z.string().min(1, 'Customer ID is required'),
  cash_amount: z.number().nonnegative().default(0),
  upi_amount: z.number().nonnegative().default(0),
  total_paid: z.number().positive('Total paid must be greater than 0'),
  payment_type: z.enum(['full', 'partial']).default('partial'),
  notes: z.string().optional().default('')
});

export const purchaseSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  item_name: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  qty: z.number().int().nonnegative().default(1),
  unit_cost: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  notes: z.string().optional().default('')
});

export const profileSchema = z.object({
  shop_name: z.string().optional().default(''),
  owner_name: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  gstin: z.string().optional().default(''),
  upi_id: z.string().optional().default('')
});
