import { createBill, updateBill, deleteBill, restoreBill } from '../api/bills';
import { createCustomer, updateCustomer, deleteCustomer } from '../api/customers';
import { createItem, updateItem, deleteItem } from '../api/inventory';
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
      case 'RESTORE_CUSTOMER':
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

      case 'UPDATE_CUSTOMER_FULL':
        if (payload.id) {
          const editData = payload.data || {};
          await updateCustomer(payload.id, {
            name: editData.name,
            phone: editData.phone,
            email: editData.email,
            address: editData.address,
            type: editData.type || 'regular',
            credit_balance: editData.creditBalance || 0,
            credit_limit: editData.creditLimit || 0
          });
        }
        break;

      case 'DELETE_CUSTOMER':
        await deleteCustomer(payload);
        break;

      case 'ADD_INVENTORY_ITEM':
        return await createItem({
          name: payload.name,
          color_single: payload.colorSingle || 0,
          color_double: payload.colorDouble || 0,
          bw_single: payload.bwSingle || 0,
          bw_double: payload.bwDouble || 0,
          stock: payload.stock || 0,
          low_stock_alert: payload.lowStockAlert || 50
        });

      case 'UPDATE_INVENTORY_ITEM':
        if (payload.id) {
          await updateItem(payload.id, {
            name: payload.updates.name,
            color_single: payload.updates.colorSingle,
            color_double: payload.updates.colorDouble,
            bw_single: payload.updates.bwSingle,
            bw_double: payload.updates.bwDouble,
            stock: payload.updates.stock || 0,
            low_stock_alert: payload.updates.lowStockAlert || 50
          });
        }
        break;

      case 'REMOVE_INVENTORY_ITEM':
        await deleteItem(payload);
        break;

      case 'ADD_BILL':
        if (payload.customerId && !payload.isGroupParent) {
          const items = (payload.items || []).map(item => ({
            item_name: item.itemName || item.name,
            print_type: item.printType || 'color',
            sides: item.sides || 'single',
            qty: Number(item.qty || 0),
            unit_price: Number(item.unitPrice || item.rate || 0),
            amount: Number(item.amount || (item.qty * (item.unitPrice || item.rate || 0)))
          }));

          let notes = payload.notes || '';
          if (payload.loyaltyPointsEarned || payload.loyaltyPointsRedeemed) {
            notes += ` [Loyalty: earned=${payload.loyaltyPointsEarned || 0}, redeemed=${payload.loyaltyPointsRedeemed || 0}]`;
          }
          if (payload.writtenOffAmount) {
            notes += ` [WriteOff: amount=${payload.writtenOffAmount}]`;
          }

          return await createBill({
            id: payload.id,
            customer_id: payload.customerId,
            date: payload.date || new Date().toISOString().slice(0, 10),
            due_date: payload.dueDate || null,
            subtotal: Number(payload.subtotal || 0),
            discount_type: payload.discountType || 'flat',
            discount_value: Number(payload.discountValue || 0),
            gst_percent: Number(payload.gstPercent || 0),
            gst_amount: Number(payload.gstAmount || 0),
            total: Number(payload.total || 0),
            amount_paid: Number(payload.amountPaid || 0),
            balance: Number(payload.balance || 0),
            status: payload.status || 'unpaid',
            notes: notes,
            items: items
          });
        }
        break;

      case 'UPDATE_BILL':
        if (payload.id) {
          let notes = payload.updates.notes || '';
          if (payload.updates.loyaltyPointsEarned || payload.updates.loyaltyPointsRedeemed) {
            notes += ` [Loyalty: earned=${payload.updates.loyaltyPointsEarned || 0}, redeemed=${payload.updates.loyaltyPointsRedeemed || 0}]`;
          }
          if (payload.updates.writtenOffAmount) {
            notes += ` [WriteOff: amount=${payload.updates.writtenOffAmount}]`;
          }

          const mappedUpdates = {
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
            notes: notes
          };
          if (payload.updates.items) {
            mappedUpdates.items = payload.updates.items.map(item => ({
              item_name: item.itemName || item.name || item.item_name,
              print_type: item.printType || item.print_type || 'color',
              sides: item.sides || 'single',
              qty: Number(item.qty || 0),
              unit_price: Number(item.unitPrice || item.unit_price || item.rate || 0),
              amount: Number(item.amount || (item.qty * (item.unitPrice || item.unit_price || item.rate || 0)))
            }));
          }
          await updateBill(payload.id, mappedUpdates);
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
          total: payload.amount || payload.total || 0,
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
      case 'RETURN_ADVANCE_PAYMENT':
      case 'USE_ADVANCE': {
        const customerId = payload.customerId;
        const rawAmount = Number(payload.amount);
        if (!customerId || isNaN(rawAmount)) break;

        const changeAmount = action === 'USE_ADVANCE' ? -rawAmount : rawAmount;
        
        const { data: customerData, error: fetchErr } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', customerId)
          .single();

        if (fetchErr) {
          console.error(`Failed to fetch customer ${customerId} for balance sync:`, fetchErr);
          break;
        }

        const currentBalance = Number(customerData?.credit_balance || 0);
        const newBalance = currentBalance + changeAmount;

        const { error: updateErr } = await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', customerId);

        if (updateErr) {
          console.error(`Failed to update customer ${customerId} balance to ${newBalance}:`, updateErr);
          throw updateErr;
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Failed to sync entity to cloud backend:', action, err);
    throw err;
  }
};

export const clearAllCloudData = async () => {
  try {
    // Delete payments first because they reference bills and customers
    await supabase.from('payments').delete().neq('id', -1);
    // Delete bill items next
    await supabase.from('bill_items').delete().neq('id', -1);
    // Delete bills next
    await supabase.from('bills').delete().neq('id', -1);
    // Delete purchases (expenses)
    await supabase.from('purchases').delete().neq('id', -1);
    // Delete inventory items
    await supabase.from('inventory_items').delete().neq('id', -1);
    // Delete customers
    await supabase.from('customers').delete().neq('id', -1);
    // Reset advance_payments and credit balance/limit inside business_profile
    await supabase.from('business_profile').update({ advance_payments: [] }).neq('id', -1);
    
    return { success: true };
  } catch (err) {
    console.error('Failed to clear cloud database data:', err);
    throw err;
  }
};
