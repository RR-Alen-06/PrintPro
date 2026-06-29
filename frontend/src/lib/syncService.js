import { createBill, updateBill, deleteBill, restoreBill } from '../api/bills';
import { createCustomer, updateCustomer, deleteCustomer } from '../api/customers';
import { createItem, updateItem } from '../api/inventory';
import { createPayment } from '../api/payments';
import { createPurchase, deletePurchase } from '../api/purchases';
import { updateProfile } from '../api/profile';

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

      case 'UPDATE_CUSTOMER':
        if (payload.id) {
          await updateCustomer(payload.id, {
            name: payload.updates.name,
            phone: payload.updates.phone,
            email: payload.updates.email,
            address: payload.updates.address,
            type: payload.updates.type || 'regular',
            credit_balance: payload.updates.creditBalance || 0,
            credit_limit: payload.updates.creditLimit || 0
          });
        }
        break;

      case 'DELETE_CUSTOMER':
        await deleteCustomer(payload);
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

      case 'UPDATE_INVENTORY_ITEM':
        if (payload.id) {
          await updateItem(payload.id, {
            name: payload.updates.name,
            color_single: payload.updates.colorSingle,
            color_double: payload.updates.colorDouble,
            bw_single: payload.updates.bwSingle,
            bw_double: payload.updates.bwDouble,
            stock: payload.updates.stock || 0
          });
        }
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

      case 'UPDATE_BILL':
        if (payload.id) {
          await updateBill(payload.id, {
            customer_id: payload.updates.customerId,
            date: payload.updates.date,
            due_date: payload.updates.dueDate,
            subtotal: payload.updates.subtotal,
            discount_type: payload.updates.discountType,
            discount_value: payload.updates.discountValue,
            gst_percent: payload.updates.gstPercent,
            gst_amount: payload.updates.gstAmount,
            total: payload.updates.total,
            amount_paid: payload.updates.amountPaid,
            balance: payload.updates.balance,
            status: payload.updates.status,
            notes: payload.updates.notes
          });
        }
        break;

      case 'DELETE_BILL':
        await deleteBill(payload);
        break;

      case 'RESTORE_BILL':
        await restoreBill(payload);
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

      case 'ADD_EXPENSE':
        await createPurchase({
          date: payload.date || new Date().toISOString().slice(0, 10),
          item_name: payload.itemName || '',
          category: payload.category || 'General',
          qty: payload.qty || 1,
          unit_cost: payload.unitCost || payload.amount || 0,
          total: payload.amount || 0,
          notes: payload.notes || ''
        });
        break;

      case 'DELETE_EXPENSE':
        await deletePurchase(payload);
        break;

      case 'UPDATE_BUSINESS':
        await updateProfile({
          shop_name: payload.shopName,
          owner_name: payload.ownerName,
          phone: payload.phone,
          address: payload.address,
          gstin: payload.gstin,
          upi_id: payload.upiId
        });
        break;
        
      default:
        break;
    }
  } catch (err) {
    console.error('Failed to sync entity to cloud backend:', action, err);
  }
};
