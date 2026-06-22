import { createBill } from '../api/bills';
import { createCustomer } from '../api/customers';
import { createItem } from '../api/inventory';
import { createPayment } from '../api/payments';

/**
 * Pushes locally created entities to the cloud backend.
 * This ensures data written locally gets synced to the Supabase Postgres database.
 */
export const syncEntityToCloud = async (action, payload) => {
  try {
    switch (action) {
      case 'ADD_CUSTOMER':
        await createCustomer({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          type: payload.type || 'regular',
        });
        break;

      case 'ADD_INVENTORY_ITEM':
        await createItem({
          name: payload.name,
          color_single: payload.colorSingle,
          color_double: payload.colorDouble,
          bw_single: payload.bwSingle,
          bw_double: payload.bwDouble,
          stock: payload.stock || 0,
        });
        break;

      case 'ADD_BILL':
        if (payload.customerId && !payload.isGroupParent) {
          const items = payload.items.map(item => ({
            item_name: item.itemName || item.name,
            print_type: item.printType || 'color',
            sides: item.sides || 'single',
            qty: item.qty,
            unit_price: item.unitPrice || item.rate || 0,
          }));

          await createBill({
            customer_id: payload.customerId,
            date: payload.date || new Date().toISOString().slice(0, 10),
            due_date: payload.dueDate || null,
            items: items,
            discount_type: payload.discountType || 'flat',
            discount_value: payload.discountValue || 0,
            gst_percent: payload.gstPercent || 0,
            notes: payload.notes || ''
          });
        }
        break;

      case 'ADD_PAYMENT':
        if (payload.billId && payload.customerId) {
          await createPayment({
            bill_id: payload.billId,
            customer_id: payload.customerId,
            cash_amount: payload.cashAmount || 0,
            upi_amount: payload.upiAmount || 0,
            total_paid: payload.totalPaid || 0,
            payment_type: payload.paymentType || 'partial',
            notes: payload.notes || ''
          });
        }
        break;
        
      default:
        break;
    }
  } catch (err) {
    console.error('Failed to sync entity to cloud backend:', action, err);
  }
};
