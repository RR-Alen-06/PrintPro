import { createBill, updateBill, deleteBill, restoreBill } from '../api/bills';
import { createCustomer, updateCustomer, deleteCustomer } from '../api/customers';
import { createItem, updateItem } from '../api/inventory';
import { createPayment, deletePayment } from '../api/payments';
import { createPurchase, deletePurchase } from '../api/purchases';
import { updateProfile } from '../api/profile';
import { supabase } from './supabase';

/**
 * Pushes locally created entities to the cloud backend.
 * This ensures data written locally gets synced to the Supabase Postgres database.
 */
export const syncEntityToCloud = async (action, payload) => {
  try {
    switch (action) {
      case 'ADD_CUSTOMER':
        return await createCustomer({
          id: payload.id,
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          type: payload.type || 'regular',
          credit_balance: payload.creditBalance || 0,
          credit_limit: payload.creditLimit || 0
        });

      case 'UPDATE_CUSTOMER':
        if (payload.id && payload.updates) {
          const upd = {};
          if (payload.updates.name !== undefined) upd.name = payload.updates.name;
          if (payload.updates.phone !== undefined) upd.phone = payload.updates.phone;
          if (payload.updates.email !== undefined) upd.email = payload.updates.email;
          if (payload.updates.address !== undefined) upd.address = payload.updates.address;
          if (payload.updates.type !== undefined) upd.type = payload.updates.type;
          if (payload.updates.creditBalance !== undefined || payload.updates.advanceBalance !== undefined) {
            upd.credit_balance = payload.updates.advanceBalance !== undefined ? payload.updates.advanceBalance : payload.updates.creditBalance;
          }
          if (payload.updates.creditLimit !== undefined) upd.credit_limit = payload.updates.creditLimit;
          await updateCustomer(payload.id, upd);
        }
        break;

      case 'DELETE_CUSTOMER':
        await deleteCustomer(payload);
        break;

      case 'ADD_INVENTORY_ITEM':
        return await createItem({
          name: payload.name,
          color_single: payload.colorSingle,
          color_double: payload.colorDouble,
          bw_single: payload.bwSingle,
          bw_double: payload.bwDouble,
          stock: payload.stock || 0,
        });

      case 'UPDATE_INVENTORY_ITEM':
        if (payload.id && payload.updates) {
          const upd = {};
          if (payload.updates.name !== undefined) upd.name = payload.updates.name;
          if (payload.updates.colorSingle !== undefined) upd.color_single = payload.updates.colorSingle;
          if (payload.updates.colorDouble !== undefined) upd.color_double = payload.updates.colorDouble;
          if (payload.updates.bwSingle !== undefined) upd.bw_single = payload.updates.bwSingle;
          if (payload.updates.bwDouble !== undefined) upd.bw_double = payload.updates.bwDouble;
          if (payload.updates.stock !== undefined) upd.stock = payload.updates.stock;
          if (payload.updates.lowStockAlert !== undefined) upd.low_stock_alert = payload.updates.lowStockAlert;
          await updateItem(payload.id, upd);
        }
        break;

      case 'ADD_BILL':
        if (payload.customerId && !payload.isGroupParent) {
          const items = (payload.items || []).map(item => ({
            item_name: item.itemName || item.name,
            print_type: item.printType || 'color',
            sides: item.sides || 'single',
            qty: item.qty || 1,
            unit_price: item.unitPrice || item.rate || 0,
            amount: item.amount || (Number(item.qty || 1) * Number(item.unitPrice || item.rate || 0))
          }));

          return await createBill({
            id: payload.id,
            customer_id: payload.customerId,
            date: payload.date || new Date().toISOString().slice(0, 10),
            due_date: payload.dueDate || null,
            subtotal: payload.subtotal || 0,
            discount_type: payload.discountType || 'flat',
            discount_value: payload.discountValue || 0,
            gst_percent: payload.gstPercent || 0,
            gst_amount: payload.gstAmount || 0,
            total: payload.total || 0,
            amount_paid: payload.amountPaid || 0,
            balance: payload.balance !== undefined ? payload.balance : (payload.total || 0),
            status: payload.status || 'unpaid',
            notes: payload.notes || '',
            items: items
          });
        }
        break;

      case 'UPDATE_BILL':
        if (payload.id && payload.updates) {
          const u = payload.updates;
          const bUpd = {};
          if (u.customerId !== undefined) bUpd.customer_id = u.customerId;
          if (u.date !== undefined) bUpd.date = u.date;
          if (u.dueDate !== undefined) bUpd.due_date = u.dueDate;
          if (u.subtotal !== undefined) bUpd.subtotal = u.subtotal;
          if (u.discountType !== undefined) bUpd.discount_type = u.discountType;
          if (u.discountValue !== undefined) bUpd.discount_value = u.discountValue;
          if (u.gstPercent !== undefined) bUpd.gst_percent = u.gstPercent;
          if (u.gstAmount !== undefined) bUpd.gst_amount = u.gstAmount;
          if (u.total !== undefined) bUpd.total = u.total;
          if (u.amountPaid !== undefined) bUpd.amount_paid = u.amountPaid;
          if (u.balance !== undefined) bUpd.balance = u.balance;
          if (u.status !== undefined) bUpd.status = u.status;
          if (u.notes !== undefined) bUpd.notes = u.notes;
          await updateBill(payload.id, bUpd);
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
          if (payload.excessCredit > 0) {
            const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', payload.customerId).single();
            if (custData) {
              const newBal = Number(custData.credit_balance || 0) + Number(payload.excessCredit);
              await supabase.from('customers').update({ credit_balance: newBal }).eq('id', payload.customerId);
            }
          }
          return await createPayment({
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

      case 'DELETE_PAYMENT':
        if (payload) {
          await deletePayment(payload);
        }
        break;

      case 'ADD_EXPENSE':
        return await createPurchase({
          date: payload.date || new Date().toISOString().slice(0, 10),
          item_name: payload.itemName || '',
          category: payload.category || 'General',
          qty: payload.qty || 1,
          unit_cost: payload.unitCost || payload.amount || 0,
          total: payload.amount || 0,
          notes: payload.notes || ''
        });

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

      case 'ADD_ADVANCE_PAYMENT':
        if (payload && payload.customerId) {
          const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', payload.customerId).single();
          if (custData) {
            const newBal = Number(custData.credit_balance || 0) + Number(payload.amount || 0);
            await supabase.from('customers').update({ credit_balance: newBal }).eq('id', payload.customerId);
          }
        }
        break;

      case 'USE_ADVANCE':
        if (payload && payload.customerId) {
          const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', payload.customerId).single();
          if (custData) {
            const newBal = Math.max(0, Number(custData.credit_balance || 0) - Number(payload.amount || 0));
            await supabase.from('customers').update({ credit_balance: newBal }).eq('id', payload.customerId);
          }
        }
        break;

      case 'RETURN_ADVANCE_PAYMENT':
        if (payload && payload.customerId) {
          const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', payload.customerId).single();
          if (custData) {
            const newBal = Math.max(0, Number(custData.credit_balance || 0) + Number(payload.amount || 0));
            await supabase.from('customers').update({ credit_balance: newBal }).eq('id', payload.customerId);
          }
        }
        break;

      default:
        break;
    }
  } catch (err) {
    console.error('Failed to sync entity to cloud backend:', action, err);
    throw err;
  }
};
