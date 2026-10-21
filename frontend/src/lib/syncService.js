import { createBill, updateBill, deleteBill, restoreBill } from '../api/bills';
import { createCustomer, updateCustomer, deleteCustomer } from '../api/customers';
import { createItem, updateItem, deleteItem } from '../api/inventory';
import { createPayment, createRefund, deletePayment } from '../api/payments';
import { createPurchase, deletePurchase } from '../api/purchases';
import { updateProfile } from '../api/profile';
import { createAdvancePayment, updateAdvancePayment, deleteAdvancePayment } from '../api/advancePayments';
import { createCustomerGroup, updateCustomerGroup, deleteCustomerGroup } from '../api/customerGroups';
import { createGroupBill, updateGroupBill, deleteGroupBill, payGroupMember } from '../api/groupBills';
import { updateSettings } from '../api/settings';
import { updateLoyaltySettings, adjustCustomerLoyalty, deleteLoyaltyEvent, earnLoyaltyPoints, redeemLoyaltyPoints } from '../api/loyalty';
import { createPromoCode, updatePromoCode } from '../api/promoCodes';
import { openCashSession, closeCashSession } from '../api/cashSessions';

/**
 * Pushes locally created/updated entities to the cloud backend.
 * Throws an error on failure so the caller (e.g. offline queue) can handle queuing.
 */
export const syncEntityToCloud = async (action, payload) => {
  if (!payload && !['CLEAR_ALL_NOTIFICATIONS', 'MARK_ALL_NOTIFICATIONS_READ'].includes(action)) {
    return;
  }

  switch (action) {
    case 'ADD_CUSTOMER':
      return await createCustomer({
        id: payload.id,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        type: payload.type || 'regular',
        credit_balance: payload.creditBalance || payload.openingBalance || 0,
        advance_balance: payload.advanceBalance || payload.creditBalance || 0,
        credit_limit: payload.creditLimit || 0,
        customer_code: payload.customerCode || payload.customer_code || payload.id,
      });

    case 'UPDATE_CUSTOMER':
      if (payload.id) {
        return await updateCustomer(payload.id, {
          name: payload.updates?.name || payload.name,
          phone: payload.updates?.phone !== undefined ? payload.updates.phone : payload.phone,
          email: payload.updates?.email !== undefined ? payload.updates.email : payload.email,
          address: payload.updates?.address !== undefined ? payload.updates.address : payload.address,
          type: payload.updates?.type || payload.type || 'regular',
          credit_balance: payload.updates?.creditBalance !== undefined ? payload.updates.creditBalance : (payload.creditBalance || 0),
          advance_balance: payload.updates?.advanceBalance !== undefined ? payload.updates.advanceBalance : (payload.advanceBalance || 0),
          credit_limit: payload.updates?.creditLimit !== undefined ? payload.updates.creditLimit : (payload.creditLimit || 0),
          customer_code: payload.updates?.customerCode || payload.updates?.customer_code || payload.customerCode || payload.customer_code,
        });
      }
      break;

    case 'UPDATE_CUSTOMER_FULL':
      if (payload.id) {
        return await updateCustomer(payload.id, {
          name: payload.data?.name,
          phone: payload.data?.phone,
          email: payload.data?.email,
          address: payload.data?.address,
          type: payload.data?.type || 'regular',
          credit_balance: payload.data?.creditBalance || 0,
          advance_balance: payload.data?.advanceBalance || 0,
          credit_limit: payload.data?.creditLimit || 0,
          customer_code: payload.data?.customerCode || payload.data?.customer_code,
        });
      }
      break;

    case 'DELETE_CUSTOMER':
      return await deleteCustomer(payload.id || payload);

    case 'ADD_INVENTORY_ITEM':
      return await createItem({
        name: payload.name,
        item_type: payload.item_type || payload.itemType || 'paper',
        unit_price: payload.unit_price !== undefined ? payload.unit_price : (payload.unitPrice || 0),
        unit: payload.unit || 'pcs',
        color_single: payload.colorSingle || 0,
        color_double: payload.colorDouble || 0,
        bw_single: payload.bwSingle || 0,
        bw_double: payload.bwDouble || 0,
        stock: payload.stock || 0,
        low_stock_alert: payload.lowStockAlert || 50,
      });

    case 'UPDATE_INVENTORY_ITEM':
      if (payload.id) {
        return await updateItem(payload.id, {
          name: payload.updates?.name || payload.name,
          item_type: payload.updates?.item_type || payload.updates?.itemType || payload.item_type,
          unit_price: payload.updates?.unit_price !== undefined ? payload.updates.unit_price : (payload.updates?.unitPrice !== undefined ? payload.updates.unitPrice : payload.unit_price),
          unit: payload.updates?.unit !== undefined ? payload.updates.unit : payload.unit,
          color_single: payload.updates?.colorSingle,
          color_double: payload.updates?.colorDouble,
          bw_single: payload.updates?.bwSingle,
          bw_double: payload.updates?.bwDouble,
          stock: payload.updates?.stock,
          low_stock_alert: payload.updates?.lowStockAlert,
        });
      }
      break;

    case 'DELETE_INVENTORY_ITEM':
      return await deleteItem(payload.id || payload);

    case 'ADD_BILL':
      if (payload.customerId && !payload.isGroupParent) {
        const items = (payload.items || []).map((item) => {
          const name = item.itemName || item.name || item.item_name || 'Print Item';
          let printType = 'color';
          if (item.printType === 'color' || item.printType === 'bw') {
            printType = item.printType;
          } else if (item.print_type === 'color' || item.print_type === 'bw') {
            printType = item.print_type;
          }
          let sides = 'single';
          if (item.sides === 'single' || item.sides === 'double') {
            sides = item.sides;
          }
          const qty = Number(item.qty || 1);
          const unitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.rate !== undefined ? item.rate : (item.unit_price || 0)));
          const amount = item.amount !== undefined ? Number(item.amount) : (qty * unitPrice);

          return {
            name,
            item_name: name,
            print_type: printType,
            sides,
            qty,
            unit_price: unitPrice,
            amount,
          };
        });

        return await createBill({
          id: payload.id,
          bill_number: payload.billNumber || payload.bill_number || payload.id,
          customer_id: payload.customerId,
          date: payload.date ? new Date(payload.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          due_date: payload.dueDate ? new Date(payload.dueDate).toISOString().slice(0, 10) : null,
          items: items,
          subtotal: payload.subtotal || 0,
          discount_type: payload.discountType || 'flat',
          discount_value: payload.discountValue || 0,
          gst_percent: payload.gstPercent || 0,
          gst_amount: payload.gstAmount || 0,
          total: payload.total || 0,
          amount_paid: payload.amountPaid || 0,
          balance: payload.balance || 0,
          status: payload.status || 'unpaid',
          notes: payload.notes || '',
          advance_used: Number(payload.advanceUsed !== undefined ? payload.advanceUsed : (payload.advance_used !== undefined ? payload.advance_used : (payload.creditUsed || 0))),
        });
      }
      break;

    case 'UPDATE_BILL':
      if (payload.id) {
        const u = payload.updates || {};
        const updateData = {};
        const custId = u.customerId || u.customer_id;
        if (custId) updateData.customer_id = custId;
        if (u.date) updateData.date = new Date(u.date).toISOString().slice(0, 10);
        if (u.dueDate || u.due_date) updateData.due_date = new Date(u.dueDate || u.due_date).toISOString().slice(0, 10);
        if (u.subtotal !== undefined && u.subtotal !== null && u.subtotal !== '') updateData.subtotal = Number(u.subtotal);
        const discType = u.discountType || u.discount_type;
        if (discType) updateData.discount_type = discType;
        const discVal = u.discountValue !== undefined ? u.discountValue : u.discount_value;
        if (discVal !== undefined && discVal !== null && discVal !== '') updateData.discount_value = Number(discVal);
        const gstPct = u.gstPercent !== undefined ? u.gstPercent : u.gst_percent;
        if (gstPct !== undefined && gstPct !== null && gstPct !== '') updateData.gst_percent = Number(gstPct);
        const gstAmt = u.gstAmount !== undefined ? u.gstAmount : u.gst_amount;
        if (gstAmt !== undefined && gstAmt !== null && gstAmt !== '') updateData.gst_amount = Number(gstAmt);
        if (u.total !== undefined && u.total !== null && u.total !== '') updateData.total = Number(u.total);
        const amtPaid = u.amountPaid !== undefined ? u.amountPaid : u.amount_paid;
        if (amtPaid !== undefined && amtPaid !== null && amtPaid !== '') updateData.amount_paid = Number(amtPaid);
        if (u.balance !== undefined && u.balance !== null && u.balance !== '') updateData.balance = Number(u.balance);
        if (u.status) updateData.status = u.status;
        if (u.notes !== undefined && u.notes !== null) updateData.notes = String(u.notes);
        if (Array.isArray(u.items) && u.items.length > 0) {
          updateData.items = u.items.map((it) => ({
            name: it.name || it.itemName || it.item_name || 'Item',
            print_type: it.printType || it.print_type || 'color',
            sides: it.sides || 'single',
            qty: parseInt(it.qty, 10) || 1,
            unit_price: parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.unit_price || 0)),
            amount: parseFloat(it.amount !== undefined ? it.amount : 0),
            category: it.category || 'paper'
          }));
        }
        if (payload.pin_override || payload.pinOverride || u.pin_override || u.pinOverride) {
          updateData.pin_override = true;
        }
        return await updateBill(payload.id, updateData);
      }
      break;

    case 'DELETE_BILL':
      return await deleteBill(payload.id || payload);

    case 'RESTORE_BILL':
      return await restoreBill(payload.id || payload);

    case 'ADD_PAYMENT':
      if (payload.billId || payload.customerId) {
        if (payload.isRefund || payload.paymentType === 'refund' || Number(payload.totalPaid || 0) < 0) {
          return await createRefund({
            bill_id: payload.billId || payload.bill_id || null,
            customer_id: payload.customerId || payload.customer_id,
            refund_amount: Math.abs(payload.totalPaid || payload.amount || 0),
            cash_amount: Math.abs(payload.cashAmount || 0),
            upi_amount: Math.abs(payload.upiAmount || 0),
            refund_method: Math.abs(payload.cashAmount || 0) > 0 ? 'cash' : (Math.abs(payload.upiAmount || 0) > 0 ? 'upi' : 'direct'),
            notes: payload.notes || 'Refund payment',
            advance_refund_amount: payload.advanceRefundAmount || 0,
            pin_override: payload.pin_override || payload.pinOverride || false,
            security_pin: payload.security_pin || payload.securityPin || '',
          });
        }
        return await createPayment({
          bill_id: payload.billId || payload.bill_id || null,
          customer_id: payload.customerId || payload.customer_id || null,
          cash_amount: payload.cashAmount !== undefined ? payload.cashAmount : (payload.cash_amount || 0),
          upi_amount: payload.upiAmount !== undefined ? payload.upiAmount : (payload.upi_amount || 0),
          total_paid: payload.totalPaid !== undefined ? payload.totalPaid : (payload.total_paid || 0),
          payment_type: payload.paymentType || 'partial',
          is_refund: false,
          notes: payload.notes || '',
        });
      }
      break;

    case 'ADD_REFUND_PAYMENT':
      if (payload.customerId) {
        return await createRefund({
          bill_id: payload.billId || null,
          customer_id: payload.customerId,
          refund_amount: Math.abs(payload.totalPaid || payload.amount || 0),
          cash_amount: Math.abs(payload.cashAmount || 0),
          upi_amount: Math.abs(payload.upiAmount || 0),
          refund_method: payload.cashAmount !== 0 ? 'cash' : (payload.upiAmount !== 0 ? 'upi' : 'direct'),
          notes: payload.notes || 'Refund payment',
          advance_refund_amount: payload.advanceRefundAmount || 0,
          pin_override: payload.pin_override || payload.pinOverride || false,
          security_pin: payload.security_pin || payload.securityPin || '',
        });
      }
      break;

    case 'DELETE_PAYMENT':
      return await deletePayment(payload.id || payload);

    case 'ADD_EXPENSE':
      return await createPurchase({
        date: payload.date || new Date().toISOString().slice(0, 10),
        item_name: payload.itemName || payload.name || 'Expense',
        category: payload.category || 'General',
        qty: payload.qty || 1,
        unit_cost: payload.unitCost || payload.amount || 0,
        total: payload.amount || 0,
        notes: payload.notes || '',
        vendor_name: payload.vendorName || payload.vendor_name || '',
        payment_method: payload.paymentMethod || payload.payment_method || 'cash',
        upi_ref: payload.upiRef || payload.upi_ref || '',
      });

    case 'DELETE_EXPENSE':
      return await deletePurchase(payload.id || payload);

    case 'UPDATE_BUSINESS':
      return await updateProfile({
        shop_name: payload.shopName ?? payload.shop_name,
        owner_name: payload.ownerName ?? payload.owner_name,
        phone: payload.phone,
        address: payload.address,
        gstin: payload.gstin,
        upi_id: payload.upiId ?? payload.upi_id,
      });

    case 'ADD_ADVANCE_PAYMENT':
      return await createAdvancePayment({
        customer_id: payload.customerId,
        amount: payload.amount || 0,
        payment_mode: payload.paymentMethod || payload.paymentMode || 'cash',
        type: payload.type || 'deposit',
        bill_id: payload.billId || null,
        notes: payload.notes || '',
        date: payload.date || new Date().toISOString().slice(0, 10),
      });

    case 'UPDATE_ADVANCE_PAYMENT':
      if (payload.id) {
        return await updateAdvancePayment(payload.id, {
          amount: payload.updates?.amount || payload.amount,
          payment_mode: payload.updates?.paymentMethod || payload.updates?.paymentMode || payload.paymentMethod,
          type: payload.updates?.type || payload.type,
          notes: payload.updates?.notes || payload.notes,
          date: payload.updates?.date || payload.date,
        });
      }
      break;

    case 'DELETE_ADVANCE_PAYMENT':
      return await deleteAdvancePayment(payload.id || payload);

    case 'RETURN_ADVANCE_PAYMENT':
      return await createAdvancePayment({
        customer_id: payload.customerId,
        amount: Math.abs(payload.amount || 0),
        payment_mode: payload.paymentMethod || 'cash',
        type: 'refund',
        notes: payload.notes || 'Advance returned to customer',
        date: payload.date || new Date().toISOString().slice(0, 10),
      });

    case 'USE_ADVANCE':
      if (payload.customerId && payload.newBalance !== undefined) {
        return await updateCustomer(payload.customerId, {
          advance_balance: payload.newBalance,
          credit_balance: payload.newBalance,
        });
      }
      break;

    case 'ADD_CUSTOMER_GROUP':
      return await createCustomerGroup({
        name: payload.name,
        description: payload.description || '',
        member_ids: payload.memberIds || payload.members || [],
      });

    case 'UPDATE_CUSTOMER_GROUP':
      if (payload.id) {
        return await updateCustomerGroup(payload.id, {
          name: payload.updates?.name || payload.name,
          description: payload.updates?.description || payload.description,
          member_ids: payload.updates?.memberIds || payload.updates?.members || payload.memberIds,
        });
      }
      break;

    case 'DELETE_CUSTOMER_GROUP':
      return await deleteCustomerGroup(payload.id || payload);

    case 'ADD_GROUP_BILL':
      return await createGroupBill({
        id: payload.id,
        group_id: payload.groupId || payload.group_id || 'GENERAL',
        title: payload.title || (payload.type ? `${payload.type.toUpperCase()} Group Bill ${payload.id || ''}` : `Group Bill ${payload.id || ''}`),
        total_amount: payload.totalAmount || 0,
        amount_paid: payload.amountPaid || 0,
        status: payload.status || 'unpaid',
        member_shares: payload.memberShares || payload.memberBillIds || [],
        notes: payload.notes || '',
        date: payload.date || new Date().toISOString().slice(0, 10),
      });

    case 'UPDATE_GROUP_BILL':
      if (payload.id) {
        return await updateGroupBill(payload.id, {
          title: payload.updates?.title || payload.title,
          total_amount: payload.updates?.totalAmount || payload.totalAmount,
          amount_paid: payload.updates?.amountPaid || payload.amountPaid,
          status: payload.updates?.status || payload.status,
          member_shares: payload.updates?.memberShares || payload.memberShares,
          notes: payload.updates?.notes || payload.notes,
        });
      }
      break;

    case 'DELETE_GROUP_BILL':
      return await deleteGroupBill(payload.id || payload);

    case 'PAY_GROUP_MEMBER': {
      const gbId = payload.groupBillId || payload.id;
      if (gbId) {
        return await payGroupMember(gbId, {
          memberId: payload.memberId,
          customerId: payload.customerId,
          paymentAmount: payload.paymentAmount,
          paymentMethod: payload.paymentMethod || { cash: payload.paymentAmount, upi: 0 },
          notes: payload.notes || '',
        });
      }
      break;
    }

    case 'UPDATE_SETTINGS':
      return await updateSettings(payload.settings || payload);

    case 'UPDATE_LOYALTY_SETTINGS':
      return await updateLoyaltySettings({
        points_per_rupee: payload.loyaltyEarningRate,
        rupee_per_point: payload.loyaltyRedeemRatioRupees,
        min_points_redeem: payload.loyaltyRedeemRatioPoints,
        tier_config: payload.loyaltyTiers,
        redeem_options: payload.loyaltyRedeemOptions,
        is_enabled: payload.loyaltyEnabled !== false,
      });

    case 'ADD_LOYALTY_ADJUSTMENT':
      if (payload.customerId) {
        return await adjustCustomerLoyalty(payload.customerId, {
          points: payload.points || 0,
          operation: payload.operation || (Number(payload.points) >= 0 ? 'add' : 'deduct'),
          event_type: payload.eventType || payload.event_type || 'manual_adjust',
          notes: payload.notes || '',
        });
      }
      break;

    case 'DELETE_LOYALTY_EVENT': {
      const eventId = payload.id || payload.eventId || payload;
      if (eventId) {
        return await deleteLoyaltyEvent(eventId);
      }
      break;
    }

    case 'EARN_LOYALTY_POINTS':
      if (payload.customerId) {
        return await earnLoyaltyPoints({
          customer_id: payload.customerId,
          bill_id: payload.billId || null,
          points: payload.points || 0,
          notes: payload.notes || '',
        });
      }
      break;

    case 'REDEEM_LOYALTY_POINTS':
      if (payload.customerId) {
        return await redeemLoyaltyPoints({
          customer_id: payload.customerId,
          bill_id: payload.billId || null,
          points: payload.points || 0,
          notes: payload.notes || '',
        });
      }
      break;

    case 'SET_PROMO_CODES':
      if (Array.isArray(payload)) {
        for (const promo of payload) {
          if (promo.id && !String(promo.id).startsWith('temp')) {
            await updatePromoCode(promo.id, {
              code: promo.code,
              discount_type: promo.type || promo.discount_type,
              discount_value: promo.value || promo.discount_value,
              min_bill_amount: promo.minAmount || promo.min_bill_amount,
              max_discount: promo.maxDiscount || promo.max_discount,
              usage_limit: promo.usageLimit || promo.usage_limit,
              valid_from: promo.validFrom || promo.valid_from,
              valid_until: promo.validUntil || promo.valid_until,
              is_active: promo.isActive !== undefined ? promo.isActive : promo.is_active,
            }).catch(() => {});
          } else {
            await createPromoCode({
              code: promo.code,
              discount_type: promo.type || promo.discount_type,
              discount_value: promo.value || promo.discount_value,
              min_bill_amount: promo.minAmount || promo.min_bill_amount,
              max_discount: promo.maxDiscount || promo.max_discount,
              usage_limit: promo.usageLimit || promo.usage_limit,
              valid_from: promo.validFrom || promo.valid_from,
              valid_until: promo.validUntil || promo.valid_until,
              is_active: promo.isActive !== undefined ? promo.isActive : promo.is_active,
            }).catch(() => {});
          }
        }
      }
      break;

    case 'OPEN_CASH_SESSION':
      return await openCashSession({
        opening_cash: payload.opening_cash || payload.opening_float || 0,
        notes: payload.notes || ''
      });

    case 'CLOSE_CASH_SESSION':
      if (payload.id && !String(payload.id).startsWith('local-')) {
        return await closeCashSession(payload.id, {
          closing_cash: payload.closing_cash || payload.physical_count || 0,
          notes: payload.notes || ''
        });
      }
      break;

    default:
      break;
  }
};
